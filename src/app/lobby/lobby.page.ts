import { Component, NgZone } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import {
  ActiveBorough,
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

  /** The claim card the player has picked up, waiting for them to choose where to play it. */
  selectedCard: HandCard | null = null;

  /** The hand card whose full details are open. Null means the modal is closed. */
  detailsCard: HandCard | null = null;

  /** A Steal picked up and waiting for a target among the other teams' boroughs. */
  selectedSteal: PowerCard | null = null;

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

  readonly boardSizeOptions = [4, 5, 6, 7, 8, 9, 10];

  private boardSizeLoaded = false;

  code = '';
  private pollHandle: ReturnType<typeof setInterval> | null = null;
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
    this.selectedCard = null;
    this.selectedSteal = null;
    void this.refresh();
    void this.loadPowerConfigurations();
    this.pollHandle = setInterval(() => void this.refresh(), POLL_INTERVAL_MS);
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

  /** A claim card goes on the open board, and nowhere else. */
  canPlayOnActive(borough: ActiveBorough): boolean {
    return this.selectedCard !== null && !!borough;
  }

  /** A Steal goes at any borough another team holds, unless they fortified it. */
  canPlayOnTerritory(territory: Territory): boolean {
    return this.selectedSteal !== null && territory.teamId !== this.game?.yourTeamId && !territory.isFortified;
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

  /** Picks up the card whose details are open, ready to be played at a borough. */
  playFromDetails(): void {
    const card = this.detailsCard;
    this.zone.run(() => {
      this.selectedCard = this.selectedCard?.id === card?.id ? null : card;
      this.selectedSteal = null;
      this.detailsCard = null;
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

  /** Asks how the challenge went, then plays the card either way — a spent card is spent. */
  async playAt(boroughId: string, boroughName: string): Promise<void> {
    const card = this.selectedCard;
    if (!card) {
      return;
    }

    const alert = await this.alerts.create({
      header: card.title,
      subHeader: boroughName,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Failed', handler: () => void this.submitPlay(card, boroughId, false) },
        { text: 'Done it', handler: () => void this.submitPlay(card, boroughId, true) },
      ],
    });

    await alert.present();
  }

  private async submitPlay(card: HandCard, boroughId: string, succeeded: boolean): Promise<void> {
    this.selectedCard = null;
    await this.act(() => this.gameService.playCard(this.code, card.id, boroughId, succeeded));
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
   * A Steal is picked up and waits for a target; a curse or boost is played on the spot, after a
   * check, since there's no taking it back.
   */
  async playPowerFromDetails(): Promise<void> {
    const card = this.detailsPower;
    if (!card) {
      return;
    }

    if (card.kind === 'Steal') {
      this.zone.run(() => {
        this.selectedSteal = this.selectedSteal?.id === card.id ? null : card;
        this.selectedCard = null;
        this.detailsPower = null;
      });
      return;
    }

    this.closePowerDetails();

    if (card.kind === 'Curse' || card.kind === 'Swap') {
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
    const isSwap = card.kind === 'Swap';

    const alert = await this.alerts.create({
      header: isSwap ? 'Swap with which team?' : `Who gets ${card.title}?`,
      subHeader: isSwap
        ? "You'll see their power cards, then pick one to take and one to give."
        : card.durationMinutes ? `For ${card.durationMinutes} minutes` : 'Until they mark it cleared',
      inputs: others.map((team, index) => ({
        type: 'radio' as const,
        label: team.name,
        value: team.id,
        checked: index === 0,
      })),
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: isSwap ? 'See their cards' : 'Curse them',
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
    const card = this.selectedSteal;
    if (!card) {
      return;
    }

    const alert = await this.alerts.create({
      header: `Steal ${territory.name}?`,
      subHeader: `From ${territory.teamName}`,
      message: 'The steal challenge is revealed and its clock starts now. There is no backing out.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Steal it',
          handler: () => {
            this.selectedSteal = null;
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

  /** Each side must be picked whenever that side has anything to pick from. */
  canCompleteSwap(swap: PendingSwap): boolean {
    const needsTake = swap.theirCards.length > 0;
    const needsGive = this.unplayedPowers.length > 0;

    return (!needsTake || !!this.swapTake[swap.cardId]) && (!needsGive || !!this.swapGive[swap.cardId]);
  }

  completeSwap(swap: PendingSwap): Promise<void> {
    const take = this.swapTake[swap.cardId] ?? null;
    const give = this.swapGive[swap.cardId] ?? null;
    delete this.swapTake[swap.cardId];
    delete this.swapGive[swap.cardId];

    return this.act(() => this.gameService.completeSwap(this.code, swap.cardId, take, give));
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

    const alert = await this.alerts.create({
      header: score.name,
      message: held.length > 0
        ? held.map(t => t.name).join('<br>')
        : 'No boroughs claimed yet.',
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

  /** Every lobby action returns the updated game, so the screen doesn't wait for the next poll. */
  private async act(action: () => Promise<Game>): Promise<void> {
    this.busy = true;
    this.error = null;
    try {
      this.apply(await action());
    } catch (error: unknown) {
      this.error =
        (error as { error?: { title?: string } })?.error?.title ?? 'That did not work.';
    } finally {
      this.busy = false;
    }
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
  }
}
