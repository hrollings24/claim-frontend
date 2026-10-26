import { Component, NgZone } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import {
  Curse,
  Game,
  GamePlayer,
  GameService,
  HandCard,
  IncomingSteal,
  PendingSwap,
  PowerCard,
  PowerKind,
  powerKindColor,
  PowerOffer,
  StealOutcome,
  Territory,
  TeamScore,
} from '../game.service';
import { LastGameService } from '../last-game.service';
import { PowerConfigService, PowerConfiguration } from '../power-config.service';
import { TEAM_COLORS, teamHex } from '../team-colors';
import { GameTeam } from '../game.service';

/**
 * The roster changes rarely (someone joins, someone leaves), so it is polled rather than
 * pushed. Live updates would mean an API Gateway WebSocket API, which is a lot of moving
 * parts for a list that changes every few seconds.
 */
const POLL_INTERVAL_MS = 3000;

@Component({
  selector: 'app-lobby',
  templateUrl: 'lobby.page.html',
  styleUrls: ['lobby.page.scss'],
  standalone: false,
})
export class LobbyPage {
  game: Game | null = null;
  error: string | null = null;
  busy = false;

  /** The hand card whose full details are open. Null means the modal is closed. */
  detailsCard: HandCard | null = null;

  /**
   * Open while the player is choosing where to play a card: a claim challenge goes on a borough
   * on the board, a Steal at one another team holds. A page of its own, so the choices are right
   * there rather than somewhere down the game screen.
   */
  picker:
    | { kind: 'claim'; card: HandCard }
    | { kind: 'steal'; card: PowerCard }
    | { kind: 'swap'; card: PowerCard }
    | null = null;

  /**
   * The played Swap whose take-and-give page is open, by card id. Kept apart from the picker: the
   * page outlives it, and reopens from the game screen if left for later.
   */
  swapSheet: string | null = null;

  /** The power card whose details are open. Null means that modal is closed. */
  detailsPower: PowerCard | null = null;

  /** Which cards of each pending offer the player has ticked, by offer id. */
  private offerPicks: Record<string, string[]> = {};

  /** Every configuration, for the host's picker. Loaded once per visit to the lobby. */
  powerConfigurations: PowerConfiguration[] = [];

  /** Bound to the host's picker; seeded from the game once, like the other settings. */
  powerConfigurationId: string | null = null;

  private powerConfigurationLoaded = false;

  readonly kindColor: (kind: PowerKind) => string = powerKindColor;

  readonly teamColors = TEAM_COLORS;

  /**
   * Which sections this player has folded away, by name. Remembered on this phone only — it's a
   * matter of taste, not something the game needs to know.
   */
  private collapsed: Record<string, boolean> = LobbyPage.loadCollapsed();

  private static readonly collapsedKey = 'lobby.collapsed';

  /** Game length as the two fields the lobby shows, kept whole in minutes on the server. */
  durationHours = 1;
  durationMinutesPart = 0;

  readonly hourOptions = Array.from({ length: 24 }, (_, hour) => hour);
  readonly minuteOptions = Array.from({ length: 12 }, (_, index) => index * 5);

  /** How long the hot borough stands before moving on its own. */
  hotRotationMinutes = 90;

  readonly hotRotationOptions = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180];

  /** Boroughs on the board. Null leaves it to the game, which fits it to the number of teams. */
  boardSize: number | null = null;

  readonly boardSizeOptions = Array.from({ length: 13 }, (_, index) => index + 4);

  private boardSizeLoaded = false;

  code = '';
  private pollHandle: ReturnType<typeof setInterval> | null = null;

  /**
   * Ticks once a second so countdowns — steals, curses, the hot borough — count down smoothly
   * rather than in jumps each time the game is polled. It runs in Angular's zone, so each tick is
   * a change detection pass and nothing more.
   */
  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private refreshing = false;

  /**
   * Only the host can change the length, so once these fields are seeded from the game there
   * is nobody else who could move them underneath the host mid-edit.
   */
  private durationLoaded = false;

  /** Same reasoning as {@link durationLoaded}, for the hot-rotation field. */
  private hotRotationLoaded = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private gameService: GameService,
    private alerts: AlertController,
    private toasts: ToastController,
    private zone: NgZone,
    private lastGame: LastGameService,
    private powerConfigs: PowerConfigService,
  ) {}

  ionViewWillEnter(): void {
    this.code = this.route.snapshot.paramMap.get('code') ?? '';
    this.error = null;
    this.durationLoaded = false;
    this.hotRotationLoaded = false;
    this.powerConfigurationLoaded = false;
    this.boardSizeLoaded = false;
    this.picker = null;
    this.swapSheet = null;
    void this.refresh();
    void this.loadPowerConfigurations();
    this.pollHandle = setInterval(() => void this.refresh(), POLL_INTERVAL_MS);
    this.tickHandle = setInterval(() => undefined, 1000);
  }

  ionViewWillLeave(): void {
    this.stopPolling();
  }

  get canEditDuration(): boolean {
    return this.durationHours * 60 + this.durationMinutesPart > 0;
  }

  teamNameFor(player: GamePlayer): string {
    if (player.teamId === null) {
      return 'No team';
    }

    return this.game?.teams.find((team) => team.id === player.teamId)?.name ?? 'No team';
  }

  memberCount(teamId: string): number {
    return this.game?.players.filter((player) => player.teamId === teamId).length ?? 0;
  }

  formatDuration(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) {
      return `${minutes} min`;
    }

    return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
  }

  async refresh(): Promise<void> {
    // A slow response shouldn't stack up behind the next tick of the poll.
    if (this.refreshing) {
      return;
    }

    this.refreshing = true;
    try {
      this.apply(await this.gameService.get(this.code));
    } catch (error: unknown) {
      // 404 is terminal: the last player left, or the lobby expired. Anything else is treated
      // as a blip and left for the next poll to retry.
      if ((error as { status?: number })?.status === 404) {
        this.stopPolling();
        this.game = null;
        this.error = 'This game no longer exists.';
        this.lastGame.clear();
      }
    } finally {
      this.refreshing = false;
    }
  }

  get board() {
    return this.game?.board ?? null;
  }

  get pageTitle(): string {
    switch (this.game?.status) {
      case 'InProgress':
        return 'In play';
      case 'Finished':
        return 'Game over';
      default:
        return 'Waiting room';
    }
  }

  /** Territories held by anyone other than the player's own team — the stealable ones. */
  get opposingTerritories(): Territory[] {
    return (this.board?.territories ?? []).filter(t => t.teamId !== this.game?.yourTeamId);
  }

  get ownTerritories(): Territory[] {
    return (this.board?.territories ?? []).filter(t => t.teamId === this.game?.yourTeamId);
  }

  /** Where a Steal can go: any borough another team holds. Fortified ones are shown, but locked. */
  get stealTargets(): Territory[] {
    return this.opposingTerritories;
  }

  /** Same zone caveat as {@link closeCardDetails}. */
  closePicker(): void {
    this.zone.run(() => {
      this.picker = null;
    });
  }

  viewCardDetails(card: HandCard): void {
    this.detailsCard = card;
  }

  /**
   * Ionic moves the modal out of this page and into ion-app when it presents, so its own
   * buttons and dismiss events fire outside Angular's zone — clearing state has to re-enter it,
   * or the [isOpen] binding never updates and the modal stays on screen.
   */
  closeCardDetails(): void {
    this.zone.run(() => {
      this.detailsCard = null;
    });
  }

  /** Opens the borough picker for the card whose details are open. */
  playFromDetails(): void {
    const card = this.detailsCard;
    this.zone.run(() => {
      this.detailsCard = null;
      this.picker = card ? { kind: 'claim', card } : null;
    });
  }

  timeRemaining(): string {
    const endsAt = this.board?.endsAt;
    if (!endsAt) {
      return '';
    }

    const minutes = Math.max(0, Math.round((new Date(endsAt).getTime() - Date.now()) / 60000));

    return this.formatDuration(minutes) + ' left';
  }

  /**
   * Confirms before claiming. A claim can't be failed — you only play one once it's done — so
   * the only question is whether you meant to tap this borough.
   */
  async playAt(boroughId: string, boroughName: string): Promise<void> {
    if (this.picker?.kind !== 'claim') {
      return;
    }

    const card = this.picker.card;
    const alert = await this.alerts.create({
      header: `Claim ${boroughName}?`,
      subHeader: card.title,
      message: 'Only once you\'ve completed the challenge.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Done it',
          handler: () => {
            this.closePicker();
            void this.submitPlay(card, boroughId);
          },
        },
      ],
    });

    await alert.present();
  }

  /**
   * Claims, then opens the congratulations page for the cards the claim drew. The draw is made
   * on the server at the moment of the claim, so it is found here as the one offer that wasn't
   * there before.
   */
  private async submitPlay(card: HandCard, boroughId: string): Promise<void> {
    const boroughName = this.board?.active.find(b => b.id === boroughId)?.name ?? 'the borough';
    const wasHot = this.board?.hotBoroughId === boroughId;
    const offersBefore = new Set((this.board?.yourPowerOffers ?? []).map(offer => offer.id));

    await this.act(() => this.gameService.playCard(this.code, card.id, boroughId));

    const claimed = this.board?.territories.some(t => t.id === boroughId && t.teamId === this.game?.yourTeamId);
    if (!claimed) {
      return;
    }

    const offer = (this.board?.yourPowerOffers ?? []).find(o => !offersBefore.has(o.id)) ?? null;
    this.zone.run(() => {
      this.celebration = offer
        ? this.celebrationFor(offer)
        : { offerId: null, source: 'Claim', boroughName, fromTeamName: null, wasHot, revealed: 0 };
    });
  }

  // ---- The draw page: after a claim, or after surviving a steal ----

  /**
   * Open while the draw page is showing. Holds the offer's id rather than the offer, so it always
   * reads the latest copy from the game — and closes itself if the offer is chosen from another
   * phone in the meantime. `revealed` is how many cards have been turned over so far.
   */
  celebration: {
    offerId: string | null;
    source: PowerOffer['source'];
    boroughName: string;
    fromTeamName: string | null;
    wasHot: boolean;
    revealed: number;
  } | null = null;

  private celebrationFor(offer: PowerOffer): NonNullable<LobbyPage['celebration']> {
    return {
      offerId: offer.id,
      source: offer.source,
      boroughName: offer.boroughName ?? 'the borough',
      fromTeamName: offer.fromTeamName,
      wasHot: offer.wasHot,
      revealed: 0,
    };
  }

  get celebrationOffer(): PowerOffer | null {
    const id = this.celebration?.offerId;
    return id ? (this.board?.yourPowerOffers ?? []).find(o => o.id === id) ?? null : null;
  }

  /** From a waiting draw on the game screen — a "Choose later", or a steal that failed on you. */
  openDraw(offer: PowerOffer): void {
    this.celebration = this.celebrationFor(offer);
  }

  /** The cards turned over so far, in the order they were drawn. */
  revealedCards(offer: PowerOffer): PowerCard[] {
    return offer.cards.slice(0, this.celebration?.revealed ?? 0);
  }

  allDrawn(offer: PowerOffer): boolean {
    return (this.celebration?.revealed ?? 0) >= offer.cards.length;
  }

  /**
   * Turns over one more card — the draw is one card per tap, for the drama. Everything the page
   * does goes through the zone: Ionic moves a modal out of the page, its buttons fire outside
   * Angular's zone, and state changed there is never rendered.
   */
  drawNext(): void {
    this.zone.run(() => {
      const offer = this.celebrationOffer;
      if (this.celebration && offer && !this.allDrawn(offer)) {
        this.celebration = { ...this.celebration, revealed: this.celebration.revealed + 1 };
      }
    });
  }

  toggleDrawn(offer: PowerOffer, card: PowerCard): void {
    this.zone.run(() => this.togglePick(offer, card));
  }

  /** Keeps what's ticked — nothing, if the team has no room — then back to the game. */
  confirmDraw(): Promise<void> {
    return this.zone.run(async () => {
      const offer = this.celebrationOffer;
      if (offer) {
        await this.keepOffer(offer);
      }

      this.celebration = null;
    });
  }

  /** The offer stays on the game screen, so leaving now loses nothing. */
  closeCelebration(): void {
    this.zone.run(() => {
      this.celebration = null;
    });
  }

  get celebrationPicked(): number {
    const offer = this.celebrationOffer;
    return offer ? (this.offerPicks[offer.id] ?? []).length : 0;
  }

  // ---- Power cards ----

  get unplayedPowers(): PowerCard[] {
    return (this.board?.yourPowers ?? []).filter(card => card.playedAt === null);
  }

  get playedPowers(): PowerCard[] {
    return (this.board?.yourPowers ?? []).filter(card => card.playedAt !== null);
  }

  /** Steals played whose clock is still running — the team's most urgent business. */
  get runningSteals(): PowerCard[] {
    return this.playedPowers.filter(card => card.steal !== null && card.steal.outcome === null);
  }

  /** Room left under the limit on unplayed cards. */
  get freePowerSlots(): number {
    return Math.max(0, (this.board?.maxPowerCards ?? 0) - this.unplayedPowers.length);
  }

  isPicked(offer: PowerOffer, card: PowerCard): boolean {
    return (this.offerPicks[offer.id] ?? []).includes(card.id);
  }

  /** How many of this offer can still be ticked — its allowance, or the room left, if smaller. */
  pickLimit(offer: PowerOffer): number {
    return Math.min(offer.keep, this.freePowerSlots);
  }

  canPick(offer: PowerOffer, card: PowerCard): boolean {
    return this.isPicked(offer, card) || (this.offerPicks[offer.id] ?? []).length < this.pickLimit(offer);
  }

  togglePick(offer: PowerOffer, card: PowerCard): void {
    const picks = this.offerPicks[offer.id] ?? [];

    if (picks.includes(card.id)) {
      this.offerPicks[offer.id] = picks.filter(id => id !== card.id);
    } else if (this.canPick(offer, card)) {
      this.offerPicks[offer.id] = [...picks, card.id];
    }
  }

  isPickedAny(offer: PowerOffer): boolean {
    return (this.offerPicks[offer.id] ?? []).length > 0;
  }

  /** Keeps whatever is ticked — possibly nothing, which turns the offer down. */
  async keepOffer(offer: PowerOffer): Promise<void> {
    const picks = this.offerPicks[offer.id] ?? [];
    delete this.offerPicks[offer.id];
    await this.act(() => this.gameService.keepPowers(this.code, offer.id, picks));
  }

  viewPowerDetails(card: PowerCard): void {
    this.detailsPower = card;
  }

  /** Same zone caveat as {@link closeCardDetails}. */
  closePowerDetails(): void {
    this.zone.run(() => {
      this.detailsPower = null;
    });
  }

  /**
   * A Steal opens the picker for its target; a curse or boost is played on the spot, after a
   * check, since there's no taking it back.
   */
  async playPowerFromDetails(): Promise<void> {
    const card = this.detailsPower;
    if (!card) {
      return;
    }

    if (card.kind === 'Steal') {
      this.zone.run(() => {
        this.detailsPower = null;
        this.picker = { kind: 'steal', card };
      });
      return;
    }

    this.closePowerDetails();

    if (card.kind === 'Swap') {
      this.zone.run(() => {
        this.picker = { kind: 'swap', card };
      });
      return;
    }

    if (card.kind === 'Curse') {
      await this.pickTeamFor(card);
      return;
    }

    if (card.kind === 'Fortify') {
      await this.pickBoroughToFortify(card);
      return;
    }

    const alert = await this.alerts.create({
      header: `Play ${card.title}?`,
      message: 'It is marked as played straight away. Let the others know in the group chat if it affects them.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Play it', handler: () => void this.act(() => this.gameService.playPower(this.code, card.id)) },
      ],
    });

    await alert.present();
  }

  /**
   * A curse lands on one team, picked here; they're told by notification and see it in the app.
   * A Swap reveals the picked team's power cards, to take one and give one back.
   */
  private async pickTeamFor(card: PowerCard): Promise<void> {
    const others = (this.game?.teams ?? []).filter(team => team.id !== this.game?.yourTeamId);

    const alert = await this.alerts.create({
      header: `Who gets ${card.title}?`,
      subHeader: card.durationMinutes ? `For ${card.durationMinutes} minutes` : 'Until they mark it cleared',
      inputs: others.map((team, index) => ({
        type: 'radio' as const,
        label: team.name,
        value: team.id,
        checked: index === 0,
      })),
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Curse them',
          handler: (teamId: string) =>
            void this.act(() => this.gameService.playPower(this.code, card.id, { targetTeamId: teamId })),
        },
      ],
    });

    await alert.present();
  }

  /** Fortify locks one of your own boroughs — not one with a steal already running on it. */
  private async pickBoroughToFortify(card: PowerCard): Promise<void> {
    const underAttack = new Set(this.incomingSteals.map(steal => steal.boroughId));
    const eligible = this.ownTerritories.filter(t => !t.isFortified && !underAttack.has(t.id));

    if (eligible.length === 0) {
      const none = await this.alerts.create({
        header: 'Nothing to fortify',
        message: 'You need a borough that isn\'t already fortified and doesn\'t have a steal running on it.',
        buttons: ['OK'],
      });
      await none.present();
      return;
    }

    const alert = await this.alerts.create({
      header: 'Fortify which borough?',
      subHeader: 'Nobody can steal it for the rest of the game.',
      inputs: eligible.map((territory, index) => ({
        type: 'radio' as const,
        label: territory.name,
        value: territory.id,
        checked: index === 0,
      })),
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Fortify it',
          handler: (boroughId: string) =>
            void this.act(() => this.gameService.playPower(this.code, card.id, { boroughId })),
        },
      ],
    });

    await alert.present();
  }

  async discardFromDetails(): Promise<void> {
    const card = this.detailsPower;
    if (!card) {
      return;
    }

    this.closePowerDetails();

    const alert = await this.alerts.create({
      header: `Discard ${card.title}?`,
      message: 'It goes back into the deck for anyone to draw.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Discard',
          role: 'destructive',
          handler: () => void this.act(() => this.gameService.discardPower(this.code, card.id)),
        },
      ],
    });

    await alert.present();
  }

  /** Committing a steal reveals the challenge and starts the clock, so it asks first. */
  async stealAt(territory: Territory): Promise<void> {
    if (this.picker?.kind !== 'steal' || territory.isFortified) {
      return;
    }

    const card = this.picker.card;

    const alert = await this.alerts.create({
      header: `Steal ${territory.name}?`,
      subHeader: `From ${territory.teamName}`,
      message: 'The steal challenge is revealed and its clock starts now. There is no backing out.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Steal it',
          handler: () => {
            this.closePicker();
            void this.act(() => this.gameService.playPower(this.code, card.id, { boroughId: territory.id }));
          },
        },
      ],
    });

    await alert.present();
  }

  resolveSteal(card: PowerCard, succeeded: boolean): Promise<void> {
    return this.act(() => this.gameService.resolveSteal(this.code, card.id, succeeded));
  }

  /** Minutes:seconds left on a running steal. Once it's out, the server fails it on the next look. */
  stealCountdown(card: PowerCard): string {
    return card.steal ? this.countdownTo(card.steal.expiresAt) : '';
  }

  countdownTo(deadline: string): string {
    const remainingMs = new Date(deadline).getTime() - Date.now();
    if (remainingMs <= 0) {
      return "Time's up";
    }

    const totalSeconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, '0')} left`;
  }

  /** The hot borough's name, for the line under the map. */
  get hotName(): string | null {
    const board = this.board;
    return board?.active.find(b => b.id === board.hotBoroughId)?.name ?? null;
  }

  /**
   * How long until the hot borough moves on its own — it also moves the moment it's claimed.
   * Minutes and seconds inside the last hour, hours and minutes before that. At zero it moves
   * on the next refresh, within a few seconds.
   */
  hotCountdown(): string {
    const rotatesAt = this.board?.hotRotatesAt;
    if (!rotatesAt || !this.board?.hotBoroughId) {
      return '';
    }

    const remainingMs = new Date(rotatesAt).getTime() - Date.now();
    if (remainingMs <= 0) {
      return 'Moving now…';
    }

    const totalSeconds = Math.ceil(remainingMs / 1000);
    if (totalSeconds >= 3600) {
      return `Moves in ${this.formatDuration(Math.ceil(totalSeconds / 60))}`;
    }

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `Moves in ${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  // ---- Curses and the cards that answer them ----

  get cursesOnYou(): Curse[] {
    return (this.board?.activeCurses ?? []).filter(curse => curse.onYou);
  }

  get cursesYouCast(): Curse[] {
    return (this.board?.activeCurses ?? []).filter(curse => !curse.onYou);
  }

  get incomingSteals(): IncomingSteal[] {
    return this.board?.incomingSteals ?? [];
  }

  /** The first unplayed Curse Reverse — which copy gets used makes no difference. */
  private get heldReverse(): PowerCard | null {
    return this.unplayedPowers.find(card => card.kind === 'Reverse') ?? null;
  }

  canReverse(curse: Curse): boolean {
    return !curse.isReversal && this.heldReverse !== null;
  }

  /** Never automatic: the team chooses to use a Curse Reverse on this curse. */
  async reverseCurse(curse: Curse): Promise<void> {
    const card = this.heldReverse;
    if (!card) {
      return;
    }

    const alert = await this.alerts.create({
      header: `Reverse ${curse.title}?`,
      message: `It starts again on ${curse.fromTeamName}, with its full time. It can't be sent back to you.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Reverse it',
          handler: () => void this.act(() => this.gameService.respondToCurse(this.code, curse.id, card.id)),
        },
      ],
    });

    await alert.present();
  }

  clearCurse(curse: Curse): Promise<void> {
    return this.act(() => this.gameService.clearCurse(this.code, curse.id));
  }

  // ---- Swaps ----

  get pendingSwaps(): PendingSwap[] {
    return this.board?.yourSwaps ?? [];
  }

  /** Which of their cards to take and which of yours to give, per open swap. */
  swapTake: Record<string, string> = {};
  swapGive: Record<string, string> = {};

  /** The other teams, for picking who to swap with. */
  get otherTeams(): GameTeam[] {
    return (this.game?.teams ?? []).filter(team => team.id !== this.game?.yourTeamId);
  }

  /**
   * Committing a Swap reveals their cards and uses the Swap up, so it asks first — then opens the
   * take-and-give page straight away. It's a gamble: a team holding nothing leaves it wasted.
   */
  async swapWith(team: GameTeam): Promise<void> {
    if (this.picker?.kind !== 'swap') {
      return;
    }

    const card = this.picker.card;
    const alert = await this.alerts.create({
      header: `Swap with ${team.name}?`,
      message: "Their power cards are revealed to you, and your Swap is used: you'll take one and give one back. If they're holding none, it's wasted.",
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'See their cards',
          // The picker stays open until the server has answered, so a refusal pops up here rather
          // than out of sight on the game screen.
          handler: () => {
            void this.zone.run(async () => {
              await this.act(() => this.gameService.playPower(this.code, card.id, { targetTeamId: team.id }));

              if (this.pendingSwaps.some(s => s.cardId === card.id)) {
                this.picker = null;
                this.swapSheet = card.id;
              } else if (this.playedPowers.some(c => c.id === card.id)) {
                this.picker = null;
                await this.swapWasted(team);
              }
            });
          },
        },
      ],
    });

    await alert.present();
  }

  /** They had nothing to take, so the Swap is spent with nothing to show for it. */
  private async swapWasted(team: GameTeam): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Nothing to swap',
      message: `${team.name} had no power cards — your Swap is wasted.`,
      buttons: ['OK'],
    });

    await alert.present();
  }

  get openSwap(): PendingSwap | null {
    return this.pendingSwaps.find(s => s.cardId === this.swapSheet) ?? null;
  }

  /** From the pending swap's card on the game screen. */
  openSwapSheet(swap: PendingSwap): void {
    this.swapSheet = swap.cardId;
  }

  /** The swap stays open on the game screen, so leaving now loses nothing. */
  closeSwapSheet(): void {
    this.zone.run(() => {
      this.swapSheet = null;
    });
  }

  /** Taps on the page go through the zone — Ionic moves modals out of the page. */
  pickTake(swap: PendingSwap, card: PowerCard): void {
    this.zone.run(() => {
      this.swapTake = { ...this.swapTake, [swap.cardId]: card.id };
    });
  }

  pickGive(swap: PendingSwap, card: PowerCard): void {
    this.zone.run(() => {
      this.swapGive = { ...this.swapGive, [swap.cardId]: card.id };
    });
  }

  /** Each side must be picked whenever that side has anything to pick from. */
  canCompleteSwap(swap: PendingSwap): boolean {
    const needsTake = swap.theirCards.length > 0;
    const needsGive = this.unplayedPowers.length > 0;

    return (!needsTake || !!this.swapTake[swap.cardId]) && (!needsGive || !!this.swapGive[swap.cardId]);
  }

  completeSwap(swap: PendingSwap): Promise<void> {
    return this.zone.run(async () => {
      const take = this.swapTake[swap.cardId] ?? null;
      const give = this.swapGive[swap.cardId] ?? null;
      delete this.swapTake[swap.cardId];
      delete this.swapGive[swap.cardId];

      await this.act(() => this.gameService.completeSwap(this.code, swap.cardId, take, give));
      this.swapSheet = null;
    });
  }

  stealOutcomeLabel(outcome: StealOutcome | null): string {
    switch (outcome) {
      case 'Succeeded':
        return 'Stolen';
      case 'Failed':
        return 'Failed';
      case 'TimedOut':
        return 'Ran out of time';

      default:
        return 'In progress';
    }
  }

  // ---- Lobby settings ----

  get selectedPowerConfiguration(): PowerConfiguration | null {
    return this.powerConfigurations.find(c => c.id === this.game?.powerConfigurationId) ?? null;
  }

  describePowerConfiguration(configuration: PowerConfiguration): string {
    return configuration.cards
      .filter(card => card.count > 0)
      .map(card => `${card.count} ${card.title}`)
      .join(' · ');
  }

  saveBoardSize(): Promise<void> {
    return this.act(() => this.gameService.setBoardSize(this.code, this.boardSize));
  }

  savePowerConfiguration(): Promise<void> {
    const id = this.powerConfigurationId;
    if (!id || id === this.game?.powerConfigurationId) {
      return Promise.resolve();
    }

    return this.act(() => this.gameService.setPowerConfiguration(this.code, id));
  }

  openPowerCards(): Promise<boolean> {
    return this.router.navigateByUrl('/power-cards');
  }

  /** Best effort: without the list, the lobby still shows the chosen name from the game. */
  private async loadPowerConfigurations(): Promise<void> {
    try {
      this.powerConfigurations = await this.powerConfigs.list();
    } catch {
      this.powerConfigurations = [];
    }
  }

  /** Shows which boroughs a team holds — tapped from their row in the scoreboard. */
  async showTeamBoroughs(score: TeamScore): Promise<void> {
    const held = (this.board?.territories ?? []).filter(t => t.teamId === score.teamId);

    // Ionic shows an alert's message as plain text, not HTML, so a <br> came out literally.
    // One name per line, kept as lines by the borough-list class.
    const alert = await this.alerts.create({
      header: score.name,
      message: held.length > 0
        ? held.map(t => t.name + (t.isFortified ? ' (fortified)' : '')).join('\n')
        : 'No boroughs claimed yet.',
      cssClass: 'borough-list',
      buttons: ['Close'],
    });

    await alert.present();
  }

  async createTeam(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'New team',
      inputs: [
        { name: 'name', type: 'text', placeholder: 'Team name', attributes: { maxlength: 40 } },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Create', handler: (data) => void this.submitTeam(data?.name ?? '') },
      ],
    });

    await alert.present();
  }

  get yourTeamColorId(): string | null {
    return this.game?.teams.find(t => t.id === this.game?.yourTeamId)?.color ?? null;
  }

  /**
   * Players starts folded once the game is under way — the roster is settled by then — and
   * everything else open, until this player says otherwise.
   */
  isCollapsed(section: string): boolean {
    return this.collapsed[section] ?? (section === 'players' && !!this.game?.board);
  }

  toggle(section: string): void {
    this.collapsed = { ...this.collapsed, [section]: !this.isCollapsed(section) };

    try {
      localStorage.setItem(LobbyPage.collapsedKey, JSON.stringify(this.collapsed));
    } catch {
      // Private browsing or blocked storage: it still folds, just isn't remembered.
    }
  }

  private static loadCollapsed(): Record<string, boolean> {
    try {
      const stored = JSON.parse(localStorage.getItem(LobbyPage.collapsedKey) ?? '{}');
      return stored && typeof stored === 'object' ? stored : {};
    } catch {
      return {};
    }
  }

  colorOf(team: GameTeam): string {
    return teamHex(team, this.game?.teams ?? []);
  }

  colorOfTeamId(teamId: string): string {
    const team = this.game?.teams.find(t => t.id === teamId);
    return team ? this.colorOf(team) : 'transparent';
  }

  /** Taken by a team other than yours — you can't pick it. */
  colorTaken(colorId: string): boolean {
    return (this.game?.teams ?? []).some(t => t.color === colorId && t.id !== this.game?.yourTeamId);
  }

  pickColor(colorId: string): Promise<void> {
    const teamId = this.game?.yourTeamId;
    if (!teamId || this.colorTaken(colorId)) {
      return Promise.resolve();
    }

    return this.act(() => this.gameService.setTeamColor(this.code, teamId, colorId));
  }

  joinTeam(teamId: string): Promise<void> {
    return this.act(() => this.gameService.joinTeam(this.code, teamId));
  }

  leaveTeam(): Promise<void> {
    return this.act(() => this.gameService.leaveTeam(this.code));
  }

  saveDuration(): Promise<void> {
    if (!this.canEditDuration) {
      return Promise.resolve();
    }

    const totalMinutes = this.durationHours * 60 + this.durationMinutesPart;

    return this.act(() => this.gameService.setDuration(this.code, totalMinutes));
  }

  saveHotRotation(): Promise<void> {
    return this.act(() => this.gameService.setHotRotation(this.code, this.hotRotationMinutes));
  }

  start(): Promise<void> {
    return this.act(() => this.gameService.start(this.code));
  }

  async leave(): Promise<void> {
    this.busy = true;
    this.stopPolling();
    try {
      await this.gameService.leave(this.code);
    } catch {
      // Leaving is best effort — either way this player is done with the lobby, and an
      // abandoned membership ages out with the game's TTL.
    } finally {
      this.lastGame.clear();
      this.busy = false;
      await this.goHome();
    }
  }

  goHome(): Promise<boolean> {
    return this.router.navigateByUrl('/home');
  }

  private submitTeam(rawName: string): Promise<void> {
    const name = rawName.trim();
    if (!name) {
      return Promise.resolve();
    }

    return this.act(() => this.gameService.createTeam(this.code, name));
  }

  /**
   * Every lobby action returns the updated game, so the screen doesn't wait for the next poll. A
   * refusal also pops up as a toast: the error line sits at the top of the screen, which is out of
   * sight from most of the game — and behind any full-screen page that's open.
   */
  private async act(action: () => Promise<Game>): Promise<void> {
    this.busy = true;
    this.error = null;
    try {
      this.apply(await action());
    } catch (error: unknown) {
      this.error =
        (error as { error?: { title?: string } })?.error?.title ?? 'That did not work.';
      void this.showError(this.error);
    } finally {
      this.busy = false;
    }
  }

  private async showError(message: string): Promise<void> {
    const toast = await this.toasts.create({
      message,
      duration: 4000,
      position: 'top',
      color: 'danger',
      buttons: [{ text: 'OK', role: 'cancel' }],
    });

    await toast.present();
  }

  private apply(game: Game): void {
    this.game = game;
    this.lastGame.set(game.code);

    if (!this.durationLoaded) {
      this.durationHours = Math.floor(game.durationMinutes / 60);
      this.durationMinutesPart = game.durationMinutes % 60;
      this.durationLoaded = true;
    }

    if (!this.hotRotationLoaded) {
      this.hotRotationMinutes = game.hotRotationMinutes;
      this.hotRotationLoaded = true;
    }

    if (!this.boardSizeLoaded) {
      this.boardSize = game.boardSize;
      this.boardSizeLoaded = true;
    }

    if (!this.powerConfigurationLoaded) {
      this.powerConfigurationId = game.powerConfigurationId;
      this.powerConfigurationLoaded = true;
    }

    // Finished from a teammate's phone while this one still had the swap page open.
    if (this.swapSheet && !(game.board?.yourSwaps ?? []).some(s => s.cardId === this.swapSheet)) {
      this.swapSheet = null;
    }

    // Chosen from a teammate's phone while this one was still on the congratulations page.
    if (this.celebration?.offerId && !(game.board?.yourPowerOffers ?? []).some(o => o.id === this.celebration?.offerId)) {
      this.celebration = null;
    }

    // A pick for an offer that's gone — kept from another phone, say — means nothing now.
    const offerIds = new Set((game.board?.yourPowerOffers ?? []).map(offer => offer.id));
    for (const id of Object.keys(this.offerPicks)) {
      if (!offerIds.has(id)) {
        delete this.offerPicks[id];
      }
    }
  }

  private stopPolling(): void {
    if (this.pollHandle !== null) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }

    if (this.tickHandle !== null) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }
}
