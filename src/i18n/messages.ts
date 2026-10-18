/**
 * Task 037. The message catalogue.
 *
 * The interface's words live here and nowhere else. A component holds a key,
 * never a sentence, so adding a language adds a file and changes nothing else.
 *
 * Two rules the shape enforces:
 *
 * - **Entries are functions, not format strings.** English inflects for number
 *   and Chinese does not; a shared `"{n} items"` template forces one of the
 *   two to read like a machine. A function lets each language answer in its
 *   own grammar.
 * - **This interface is the contract.** A language that omits an entry is a
 *   `tsc` error, not English text appearing at runtime in front of a reader
 *   who cannot read it.
 *
 * The English catalogue below is the source: it defines the keys, and the
 * others follow it.
 */
/**
 * Task 037 Addendum B. A sentence with emphasised parts - a Template preview, a
 * Set's name - whose position differs between languages. Returned as parts so
 * each language keeps its own word order; `RichText` renders them.
 */
export type RichMessage = ReadonlyArray<string | { readonly strong: string }>;

export interface Messages {
  /* --- Popup ---------------------------------------------------------- */
  productTagline(): string;
  checkingFillNest(): string;
  activeEverywhere(): string;
  globalActive(): string;
  globalPaused(): string;
  openFillNest(): string;
  invalidActivationState(): string;
  unknownError(): string;

  /* --- Website access (Popup and Overview share these) ---------------- */
  allowAccessTo(origin: string): string;
  activationIncomplete(): string;
  pageCouldNotStart(): string;
  activationCouldNotFinish(): string;
  retry(): string;

  /* --- The page status control ---------------------------------------- */
  pauseOnThisSite(): string;
  resumeOnThisSite(): string;

  /* --- Side Panel: shell and Overview ---------------------------------- */
  navSections(): string;
  navOverview(): string;
  navTemplates(): string;
  navSites(): string;
  navSettings(): string;
  loadingFillNest(): string;
  overviewHeading(): string;
  templatesLabel(): string;
  sitesLabel(): string;
  overviewGuidance(): string;
  typeDeleteToConfirm(): string;
  activeOnOrigin(origin: string): string;

  /* --- Side Panel: Sites ----------------------------------------------- */
  sitesHeading(): string;
  sitesLead(): string;
  sitesView(): string;
  bySite(): string;
  allAddresses(): string;
  search(): string;
  searchAddresses(): string;
  statusLabel(): string;
  filterAddressesByStatus(): string;
  selectAllAddresses(): string;
  sitesByWebsiteGroup(): string;
  clearSiteData(): string;
  removeSite(): string;
  noSitesMatch(): string;
  noAddressesMatch(): string;
  logicalPageMatching(): string;
  logicalPageMatchingRules(): string;
  sharedTemplateSets(): string;
  previousPage(): string;
  nextPage(): string;
  deleteLibraryWarningPrefix(): string;
  deleteLibraryWarningSuffix(): string;
  deleteTemplates(): string;
  cancel(): string;
  removeSiteWarning(): string;
  templatesBecomeGlobal(): string;
  stopMatchingQuestion(): string;
  stopMatchingExplanation(): string;
  stopMatching(): string;
  endSharing(): string;
  stopSharing(): string;
  confirm(): string;

  /* --- Side Panel: Templates ------------------------------------------- */
  templateLibraryViews(): string;
  searchFieldsAndTemplates(): string;
  searchLocationTree(): string;
  searchTemplateBodies(): string;
  noFieldsWithTemplatesHere(): string;
  share(): string;
  shareWithTheSet(): string;
  templatesPageHint(): string;
  siteLabel(): string;
  filterSite(): string;
  filterBySite(): string;
  anySite(): string;
  globalOnly(): string;
  bound(): string;
  any(): string;
  unbound(): string;
  filterByBound(): string;
  sortLabel(): string;
  sortTemplates(): string;
  reverseSortDirection(): string;
  sortDefault(): string;
  sortAlphabetical(): string;
  sortCreated(): string;
  sortUpdated(): string;
  sortUsage(): string;
  selectAll(): string;
  selectAllVisibleTemplates(): string;
  deleteSelected(): string;
  clearSelection(): string;
  save(): string;
  saveEverywhere(): string;
  saveACopyHere(): string;
  saveForSharedFields(): string;
  saveForThisField(): string;
  notOfferedAnywhere(): string;
  rename(): string;
  editTemplateContent(): string;
  edit(): string;
  unbind(): string;
  deleteAction(): string;
  templatesByLocation(): string;
  shareThisVersion(): string;

  /* --- Side Panel: Settings -------------------------------------------- */
  settingsHeading(): string;
  appearanceHeading(): string;
  lightOrDark(): string;
  colourTheme(): string;
  dataManagement(): string;
  backupDescription(): string;
  restore(): string;
  restoreDescription(): string;
  resetFillNest(): string;
  resetDescription(): string;
  resetWarning(): string;
  resetImpact(): string;
  resetImpactUnreadable(): string;
  pageProfiles(): string;
  fieldProfiles(): string;
  bindings(): string;
  aliases(): string;
  websiteAccessPermissions(): string;
  dormantWebsitePreferences(): string;
  recommendedLabel(): string;
  exportBeforeReset(): string;
  typeResetPrefix(): string;
  typeBelowSuffix(): string;
  restoreTitle(): string;
  restoringWillPrefix(): string;
  completelyReplace(): string;
  restoringWillSuffix(): string;
  impactPreview(): string;
  itemColumn(): string;
  currentColumn(): string;
  afterRestoreColumn(): string;
  globalActivation(): string;
  authorizedSitesActive(): string;
  authorizedSitesPaused(): string;
  savedPickerPosition(): string;
  exportBeforeRestore(): string;
  exportCurrentBackup(): string;
  typeRestorePrefix(): string;

  /* --- Inline Picker ---------------------------------------------------- */
  pickerRegion(): string;
  close(): string;
  noUsableField(): string;
  review(): string;
  shareWith(): string;
  /** Task 021 Addendum C: what the icon-only header actions do, shown on hover and focus. */
  leaveSharingHint(): string;
  shareWithHint(): string;
  undo(): string;
  deleteTemplateAction(): string;
  shareTemplates(): string;
  notTheSame(): string;
  later(): string;
  suggestedSharing(): string;
  dismissSuggestion(): string;
  noStableIdentity(): string;
  insertionRejected(): string;
  copyToClipboard(): string;
  copiedToClipboard(): string;
  clipboardRefused(): string;
  copyInsteadHint(): string;
  bind(): string;
  bindToSharedSet(): string;
  bindToThisField(): string;
  removeFromThisField(): string;
  deleteTemplateEverywhere(): string;
  shareWithADifferentField(): string;
  searchTemplates(): string;
  noMatchingTemplates(): string;
  allMatchingTemplates(): string;
  newTemplate(): string;
  templateContent(): string;
  useFieldContent(): string;
  saveForThisFieldOnly(): string;
  keepsPrivateHint(): string;
  matchesSimilarPage(): string;
  couldNotPreview(): string;
  shareTemplatesWith(): string;
  noOtherFieldsToShareWith(): string;
  inThisPage(): string;
  focusedField(): string;
  noOtherFieldsOnPage(): string;
  lookingForSimilarFields(): string;
  noFieldsMatchSearch(): string;
  back(): string;
  fullText(): string;
  fullTemplateText(): string;
  editTemplateContentLower(): string;

  /* --- Derived labels ---------------------------------------------------
   * Names FillNest makes up for a Page or a Field the user has not named
   * themselves. A name the user typed is theirs and is never translated.
   */
  labelTextField(): string;
  labelTextFieldNumbered(ordinal: number): string;
  labelEmail(): string;
  labelPhone(): string;
  labelWebsite(): string;
  labelPostalCode(): string;
  labelAddress(): string;
  labelFirstName(): string;
  labelLastName(): string;
  labelName(): string;
  labelHome(): string;
  labelPage(): string;

  looksLikeFilledBefore(): string;
  followingFocus(): string;
  keyboardHint(): string;
  nameThisBox(): string;

  nameForThisBox(): string;
  nameForField(label: string): string;
  renameThisBox(label: string): string;
  renameField(label: string): string;
  renameThisBoxHint(): string;
  renameFieldHint(): string;
  renameHint(): string;
  confirmMatchExplanation(templateCount: number, stopMatchingLabel: string): string;

  modeSystem(): string;
  modeLight(): string;
  modeDark(): string;
  themeDefault(): string;
  themeOcean(): string;
  themeForest(): string;
  themeAmber(): string;
  themeGraphite(): string;
  themePlum(): string;
  exportBackup(): string;
  exporting(): string;
  backupHeading(): string;
  backupPrivacyWarning(): string;

  stopSharingForThisField(): string;
  deleteNewlyGlobalTemplates(): string;
  deleteTemplatesDialog(): string;

  /* --- Outcome messages -------------------------------------------------
   * Built at runtime, so each language answers in its own grammar rather than
   * filling holes in a shared sentence.
   */
  namedThisField(name: string): string;
  restoredFieldName(name: string): string;
  savedAndBoundToSet(fieldCount: number): string;
  boundToSet(preview: string, fieldCount: number): string;
  boundToThisField(preview: string): string;
  boundToThisFieldOnly(preview: string): string;
  sharedWithWholeSetMerged(preview: string, fieldCount: number): string;
  sharedWithWholeSetCount(preview: string, fieldCount: number): string;
  removedStillShared(preview: string): string;
  removedStillUsed(preview: string, remaining: number): string;
  removedNowGlobal(preview: string): string;
  startedSharingWith(label: string): string;
  startedSharingWithOthers(count: number): string;
  startedSharingMerged(label: string, removed: string, kept: string): string;
  showFullNameOf(label: string): string;
  /** The visible word on the toggle `showFullNameOf` names. */
  showMore(): string;
  toggleSavedTemplatesFor(expanded: boolean, label: string): string;
  savedTemplateCount(count: number): string;
  savedTemplatesFor(label: string): string;
  locateOnPage(label: string): string;
  /** The Locate button's tooltip, where the Field's name is already beside it. */
  locateOnPageShort(): string;
  /** What the Picker calls a Field that offers no name of its own. */
  unnamedFieldLabel(): string;
  savedEverywhere(preview: string): string;
  savedForThisFieldMsg(preview: string): string;
  savedCopyForSharedCount(preview: string, fieldCount: number): string;
  savedCopyForThisField(preview: string): string;
  savedForThisFieldOnlyMsg(preview: string): string;
  deletedFromLibrary(preview: string): string;
  deletedFromFieldsAndLibrary(preview: string, fieldCount: number): string;
  undoLabel(action: string, preview: string): string;
  undoActionDelete(): string;
  undoActionBind(): string;
  undoActionUnbind(): string;
  undoActionShare(): string;
  undoActionCopy(): string;
  undoActionSharedCopy(): string;
  undoActionRemove(): string;
  undoActionCreate(): string;
  undoActionEdit(): string;
  mergedWith(name: string): string;
  sharedWithWholeSet(preview: string): string;
  sharedWithSet(preview: string): string;
  sharedMerged(preview: string, removed: string): string;
  savedCopyForSharedFields(preview: string): string;
  removedFromThisField(preview: string): string;
  looksLikeSameField(label: string): string;
  looksLikeSameEditor(count: number): string;
  sharedSetFieldCount(count: number): string;
  insertTitleRepeated(count: number): string;

  addressesNotRemoved(count: number): string;
  templatesNowGlobal(count: number): string;
  tabsNotUpdated(count: number): string;
  charactersTooMany(count: string): string;
  charactersLeft(count: string): string;
  clearedSiteData(count: number): string;
  deletedFromLibraryAndFields(preview: string, fieldCount: number): string;
  deletedCountFromLibraryAndFields(count: number, fieldCount: number): string;
  deletedNewlyGlobal(count: number): string;
  endedSet(setName: string, memberCount: number): string;
  madeOwnVersionAgain(preview: string): string;
  removeSiteFilter(siteId: string): string;
  removedFromThisFieldShort(preview: string): string;
  removedAccessAndData(count: number): string;
  removedCopyForShared(preview: string): string;
  removedCopyForThisField(preview: string): string;
  restoredToLibrary(preview: string): string;
  restoredToThisField(preview: string): string;
  restoredTemplates(count: number): string;
  restoredPreviousVersion(preview: string): string;
  savedEverywhereShort(preview: string): string;
  savedCopyForSharedShort(preview: string): string;
  savedCopyForThisFieldShort(preview: string): string;
  selectForDeletion(preview: string): string;
  sharedWithWholeSetShort(preview: string): string;
  stoppedMatching(origin: string, routePattern: string): string;
  stoppedSharingSetEnded(fieldLabel: string, setName: string): string;
  stoppedSharingInSet(fieldLabel: string, setName: string): string;
  viewAffectedTemplates(count: number): string;

  templatesCouldNotBeRestored(failed: number, total: number, reasons: string): string;

  /* --- Settings: language --------------------------------------------- */
  languageHeading(): string;
  languageDescription(): string;
  pageButtonHeading(): string;
  pageButtonDescription(): string;
  movePageButtonToCorner(): string;
  pageButtonMovedToCorner(): string;
  languageSystem(): string;
  /** The language's own name for itself, as Settings lists it. */
  languageName(): string;

  /* --- Task 037 Addendum B ---------------------------------------- */
  resetComplete(): string;
  resetFailed(): string;
  exportBackupFailed(): string;
  backupTooLarge(): string;
  readBackupFailed(): string;
  backupRestored(): string;
  restoreBackupFailed(): string;
  validatingBackup(): string;
  restoreEllipsis(): string;
  resetting(): string;
  restoring(): string;
  restoreData(): string;
  pickerPositionSavedValue(): string;
  pickerPositionDefaultValue(): string;
  unknownCount(): string;
  dormantWebsitePreferencesNote(count: number): string;
  emptyTemplate(): string;
  deleteTemplatesEverywhereQuestion(count: number): string;
  removesWholeLibrary(): string;
  affectedLocationsToggle(expanded: boolean, bindingCount: number): string;
  impactSites(list: string): string;
  impactPages(list: string): string;
  impactFields(list: string): string;
  noneListed(): string;
  savedForThisFieldOnlyShort(): string;
  removedOverrideForThisField(): string;
  templateNoLongerSharedWithThisField(): string;
  siteFilterCount(count: number): string;
  viewThisTab(): string;
  viewAllTemplates(): string;
  viewByLocation(): string;
  /* --- Templates: Shared Sets tab (Task 040) ----------------------------- */
  viewSharedSets(): string;
  sharedSetSummary(fieldCount: number, templateCount: number, siteCount: number): string;
  sharedTemplatesHeading(): string;
  setFieldsHeading(): string;
  memberUsesEverything(): string;
  memberOwnVersion(basePreview: string, ownPreview: string): string;
  memberDoesNotUse(preview: string): string;
  memberOnlyThisField(preview: string): string;
  noSharedSets(): string;
  renameSetNamed(setName: string): string;
  /* --- Task 042: first-use tips and feedback ---------------------------- */
  tipsHeading(): string;
  gotIt(): string;
  hideTheseTips(): string;
  hideThisTip(): string;
  tipRegion(): string;
  popupTipAllow(): string;
  pickerTipCreate(): string;
  enableFillNest(): string;
  enableFillNestDescription(): string;
  enableOnThisSite(): string;
  enableOnThisSiteDescription(): string;
  statusPageUnsupported(): string;
  statusNeedsAccess(): string;
  statusNeedsGlobal(): string;
  statusNeedsSite(): string;
  statusNeedsReload(): string;
  statusReady(): string;
  confirmShowTipsAgain(): string;
  showTipsAgainAction(): string;
  feedbackHeading(): string;
  feedbackDescription(): string;
  showFieldsBefore(count: number): string;
  allowAccess(): string;
  undoUseFieldContent(): string;
  usedFieldContent(): string;
  pickerTipInsert(): string;
  pickerTipManage(): string;
  noteThisTab(): string;
  noteAllTemplates(): string;
  noteByLocation(): string;
  noteSharedSets(): string;
  noteSites(): string;
  noteShareWith(): string;
  showTipsAgain(): string;
  tipsHeadingSettings(): string;
  tipsDescription(): string;
  tipsWillShowAgain(): string;
  copyEmail(): string;
  copyEmailLabel(address: string): string;
  emailCopied(): string;
  emailNotCopied(): string;
  leaveSharingFor(fieldLabel: string): string;
  shareVersionWithSetQuestion(preview: string, memberCount: number, setName: string): RichMessage;
  privateVersionMergesIntoShared(): string;

  /* --- User-visible errors (Task 037 acceptance 6, Addendum D) --------- */
  fieldTemplateLimit(max: number): string;
  setTemplateLimit(max: number): string;
  templateTooLong(wideCharacters: number, letters: number): string;
  // One entry per coded error (src/messages/user-error.ts). An English surface
  // shows the core's own sentence, often more specific than these; another
  // language says what it means with these.
  errorStaleUndo(): string;
  errorStaleImpact(): string;
  errorStalePageMatch(): string;
  errorInconsistentData(): string;
  errorBackupInvalid(): string;
  errorBackupTooLarge(): string;
  errorRestorePreviewStale(): string;
  errorRestoreRecoveryBlocked(): string;
  errorResetPreviewStale(): string;
  errorResetIncomplete(): string;
  errorRemoveSiteIncomplete(): string;
  errorConfirmationMismatch(): string;
  searchTemplateBodiesEllipsis(): string;
  siteUnionHint(siteCount: number, matchCount: number): string;
  sortAscending(): string;
  sortDescending(): string;
  hideFullTemplateText(): string;
  showFullTemplateText(): string;
  templatesWaitingForField(count: number): string;
  expandOrCollapseNamed(expanded: boolean, label: string): string;
  renameNamed(label: string): string;
  statusAll(): string;
  unknownField(): string;
  invalidResult(): string;
  undidStopSharing(): string;
  undidEndSet(): string;
  selectAllFilteredAddresses(): string;
  selectedOfTotal(selected: number, total: number): string;
  fieldOptionCount(count: number): string;
  selectedCount(count: number): string;
  noTemplatesMatchSearch(): string;
  addressRange(first: number, last: number, total: number): string;
  moreTemplatePreviews(count: number): string;
  actionIsAvailable(label: string): string;
  templateLengthDetail(used: string, max: string, wideCharacters: string, letters: string): string;
  noTemplatesInSetYet(): string;
  setMembers(setName: string): string;
  selectOrigin(origin: string): string;
  expandOrCollapseOrigin(expanded: boolean, origin: string): string;
  originAccess(origin: string): string;
  siteTemplatesLink(count: number): string;
  deleteAllNewlyGlobalQuestion(count: number): string;
  removeSitesQuestion(count: number): string;
  openTemplatesLink(): string;
  endSetQuestion(setName: string): string;
  endSetBody(memberCount: number): string;
  stopSharingForQuestion(fieldLabel: string): string;
  stopSharingBody(fieldLabel: string, setName: string): string;
  clearSiteDataQuestion(count: number): string;
  clearSiteDataBody(pages: number, fields: number, bindings: number, pageAliases: number, fieldAliases: number): string;
  clearSiteDataStopsRules(count: number): string;
  clearSiteDataLeavesSets(count: number): string;
  clearSiteDataAffinities(count: number, siteList: string): string;
  removedFromFieldRemainsElsewhere(preview: string, remaining: number): string;
  removedFromFieldNowGlobal(preview: string): string;
  filterBySiteCurrent(label: string): string;
  thisPageLabel(): string;
  actionFailed(): string;
  savedFieldOnlyStaysPrivate(): string;
  savedAndBound(): string;
  savedForThisFieldOnly(): string;
  stoppedSharingOwnAvailable(): string;
  mergedSetsAndShared(preview: string, fieldLabel: string, removedSet: string, set: string, combined: boolean): string;
  joinedAndShared(preview: string, fieldLabel: string, combined: boolean): string;
  mayHaveDifferentPurpose(): string;
  templateNoLongerSharedWithCurrentField(): string;
  undoSharing(): string;
  undoAddField(): string;
  undoStopSharing(): string;
  undoMerge(): string;
  undoSaveForThisField(): string;
  undoneOutcome(undoLabel: string): string;
  reusedExistingTemplates(): string;
  sharedThisFieldsTemplates(): string;
  addedFieldToSharedSet(): string;
  stoppedSharingForThisField(): string;
  deletedQuoted(preview: string): string;
  savedQuoted(preview: string): string;
  keepOpen(): string;
  turnOffKeepOpen(): string;
  sharedStatus(count: number): string;
  repeatInsertNotice(name: string, count: number): string;
  bindToSetQuestion(preview: string, setName: string, count: number): RichMessage;
  shareQuotedWithSetQuestion(preview: string, count: number, setName: string): RichMessage;
  noTemplatesInSharedSetYet(): string;
  noTemplatesBoundToField(): string;
  noSavedMatchForField(): string;
  thisFieldHeading(): string;
  shareTemplatesWithQuestion(fieldLabel: string, fieldCount: number, siteCount: number): RichMessage;
  mergeSetsAndShareQuestion(preview: string, fieldLabel: string, fieldCount: number, siteCount: number): RichMessage;
  joinSetAndShareQuestion(fieldLabel: string, setName: string, preview: string, fieldCount: number): RichMessage;
  afterwardsOverLimit(count: number, max: number): RichMessage;
  afterwardsWithinLimit(count: number, max: number): RichMessage;
  mergeSetsAndShare(): string;
  joinSetAndShare(): string;
  searchFieldsLabel(): string;
  searchFieldsToShareWith(): string;
  searchFieldsToShareTemplateWith(): string;
  searchFieldsAcrossPages(): string;
  showAllOtherFields(count: number): string;
  insertThisTemplate(): string;
  siteAffinityBadge(primarySite: string, otherCount: number): string;
}

export const en: Messages = {
  productTagline: () => "Templates where you need them.",
  checkingFillNest: () => "Checking FillNest…",
  activeEverywhere: () => "FillNest active everywhere",
  globalActive: () => "Active",
  globalPaused: () => "Paused",
  openFillNest: () => "Open FillNest",
  invalidActivationState: () => "FillNest returned an invalid activation state.",
  unknownError: () => "Unknown FillNest error",

  allowAccessTo: (origin) => `Allow access to ${origin}`,
  activationIncomplete: () => "Access allowed; activation incomplete",
  pageCouldNotStart: () => "The current page could not be started.",
  activationCouldNotFinish: () => "FillNest could not finish activation.",
  retry: () => "Retry",

  pauseOnThisSite: () => "Pause on this site",
  resumeOnThisSite: () => "Active on this site",

  navSections: () => "FillNest sections",
  navOverview: () => "Overview",
  navTemplates: () => "Templates",
  navSites: () => "Sites",
  navSettings: () => "Settings",
  loadingFillNest: () => "Loading FillNest…",
  overviewHeading: () => "Overview",
  templatesLabel: () => "Templates",
  sitesLabel: () => "Sites",
  overviewGuidance: () =>
    "Use the field control on an authorized website to insert or create a Template.",
  typeDeleteToConfirm: () => "Type delete to confirm",
  activeOnOrigin: (origin) => `FillNest active on ${origin}`,

  sitesHeading: () => "Sites",
  sitesLead: () => "Manage Website Access here. Templates are managed on the Templates page.",
  sitesView: () => "Sites view",
  bySite: () => "By site",
  allAddresses: () => "All addresses",
  search: () => "Search",
  searchAddresses: () => "Search addresses",
  statusLabel: () => "Status",
  filterAddressesByStatus: () => "Filter addresses by status",
  selectAllAddresses: () => "Select all addresses",
  sitesByWebsiteGroup: () => "Sites by website group",
  clearSiteData: () => "Clear site data",
  removeSite: () => "Remove site",
  noSitesMatch: () => "No Sites match the current filters.",
  noAddressesMatch: () => "No addresses match. Website Access can be granted from the field control on a page.",
  logicalPageMatching: () => "Logical Page Matching",
  logicalPageMatchingRules: () => "Logical Page Matching rules",
  sharedTemplateSets: () => "Shared Template Sets",
  previousPage: () => "Previous page",
  nextPage: () => "Next page",
  deleteLibraryWarningPrefix: () => "This deletes the entire Template Library. Type ",
  deleteLibraryWarningSuffix: () => " to continue.",
  deleteTemplates: () => "Delete Templates",
  cancel: () => "Cancel",
  removeSiteWarning: () => "This removes Website Access and clears saved Pages, Fields, Bindings, labels, aliases, and the selected Site Affinity. Templates stay in your library.",
  templatesBecomeGlobal: () => "Templates with no remaining Site become Global. This does not delete any Template automatically.",
  stopMatchingQuestion: () => "Stop matching this page?",
  stopMatchingExplanation: () => "FillNest stops treating matching pages here as the same logical page. Fields it had already linked through this match keep their bound Templates, but stop being shared automatically between pages; no Template is deleted or duplicated.",
  stopMatching: () => "Stop matching",
  endSharing: () => "End sharing",
  stopSharing: () => "Leave sharing",
  confirm: () => "Confirm",

  templateLibraryViews: () => "Template Library views",
  searchFieldsAndTemplates: () => "Search fields and templates here",
  searchLocationTree: () => "Search the location tree",
  searchTemplateBodies: () => "Search Template bodies",
  noFieldsWithTemplatesHere: () => "No Fields with saved Templates on this page yet.",
  share: () => "Share",
  shareWithTheSet: () => "Share with the Set",
  templatesPageHint: () => "Search filters this page only. Options are ranked by how often you use them on that Field; the edit icon edits the Template, the delete icon takes it off this Field.",
  siteLabel: () => "Site",
  filterSite: () => "Filter Site",
  filterBySite: () => "Filter by Site",
  anySite: () => "Any Site",
  globalOnly: () => "Global only",
  bound: () => "Bound",
  any: () => "Any",
  unbound: () => "Unbound",
  filterByBound: () => "Filter by Bound or Unbound",
  sortLabel: () => "Sort",
  sortTemplates: () => "Sort Templates",
  reverseSortDirection: () => "Reverse sort direction",
  sortDefault: () => "Default",
  sortAlphabetical: () => "Alphabetical",
  sortCreated: () => "Created",
  sortUpdated: () => "Updated",
  sortUsage: () => "Usage",
  selectAll: () => "Select all",
  selectAllVisibleTemplates: () => "Select all visible Templates",
  deleteSelected: () => "Delete selected",
  clearSelection: () => "Clear selection",
  save: () => "Save",
  saveEverywhere: () => "Save everywhere",
  saveACopyHere: () => "Save a copy here",
  saveForSharedFields: () => "Save for shared fields",
  saveForThisField: () => "Save for this field",
  notOfferedAnywhere: () => "Not offered anywhere",
  rename: () => "Rename",
  editTemplateContent: () => "Edit Template content",
  edit: () => "Edit",
  unbind: () => "Unbind",
  deleteAction: () => "Delete",
  templatesByLocation: () => "Templates by location",
  shareThisVersion: () => "Share this version",

  settingsHeading: () => "Settings",
  appearanceHeading: () => "Appearance",
  lightOrDark: () => "Light or dark",
  colourTheme: () => "Colour theme",
  dataManagement: () => "Data Management",
  backupDescription: () => "Save a local copy of your Templates, Sites and settings.",
  restore: () => "Restore",
  restoreDescription: () => "Replace everything here with a backup file. You confirm before anything changes.",
  resetFillNest: () => "Reset FillNest",
  resetDescription: () => "Delete everything and return FillNest to its initial state.",
  resetWarning: () => "This permanently returns FillNest to its initial state. It first removes every Website Access permission, then deletes the local data below. This cannot be undone.",
  resetImpact: () => "Reset Impact",
  resetImpactUnreadable: () => "FillNest cannot read its stored data, so it cannot list what will be removed. Resetting clears all of it, including any Templates that are still there.",
  pageProfiles: () => "Page Profiles",
  fieldProfiles: () => "Field Profiles",
  bindings: () => "Bindings",
  aliases: () => "Aliases",
  websiteAccessPermissions: () => "Website Access permissions",
  dormantWebsitePreferences: () => "Dormant website preferences",
  recommendedLabel: () => "Recommended:",
  exportBeforeReset: () => "Export a backup before resetting if you may need this data later.",
  typeResetPrefix: () => "To permanently reset FillNest, type",
  typeBelowSuffix: () => "below:",
  restoreTitle: () => "Restore FillNest Data",
  restoringWillPrefix: () => "Restoring a backup will",
  completelyReplace: () => "completely replace",
  restoringWillSuffix: () => "your current local templates, site mappings, aliases, and activation settings.",
  impactPreview: () => "Impact Preview",
  itemColumn: () => "Item",
  currentColumn: () => "Current",
  afterRestoreColumn: () => "After Restore",
  globalActivation: () => "Global Activation",
  authorizedSitesActive: () => "Authorized Sites (Active)",
  authorizedSitesPaused: () => "Authorized Sites (Paused)",
  savedPickerPosition: () => "Saved Picker Position",
  exportBeforeRestore: () => "Export a current backup before replacing your existing data. FillNest cannot verify whether you saved a file outside this Restore flow.",
  exportCurrentBackup: () => "Export current backup",
  typeRestorePrefix: () => "To confirm replacement, type",

  pickerRegion: () => "FillNest templates",
  close: () => "Close",
  noUsableField: () => "No usable field is focused. Insert and Bind are unavailable until you focus a supported field.",
  review: () => "Review",
  shareWith: () => "Share with…",
  leaveSharingHint: () =>
    "Leave sharing: this field leaves its Shared Template Set and keeps every Template it offers now, as its own. The other fields are not affected.",
  shareWithHint: () => "Share with…: choose another field. The two then share their Templates as one list.",
  undo: () => "Undo",
  deleteTemplateAction: () => "Delete template",
  shareTemplates: () => "Share Templates",
  notTheSame: () => "Not the same",
  later: () => "Later",
  suggestedSharing: () => "Suggested Template sharing",
  dismissSuggestion: () => "Dismiss this suggestion",
  noStableIdentity: () => "This editor has no stable identity, so a Template can be inserted here but not remembered.",
  insertionRejected: () => "This editor did not accept the insertion.",
  copyToClipboard: () => "Copy to clipboard",
  copiedToClipboard: () => "Copied to the clipboard - paste it into the editor.",
  clipboardRefused: () => "The browser would not let FillNest use the clipboard.",
  copyInsteadHint: () => "This editor has refused an insertion before. Copy this Template instead.",
  bind: () => "Bind",
  bindToSharedSet: () => "Bind to Shared Set",
  bindToThisField: () => "Bind to this field",
  removeFromThisField: () => "Remove from this field",
  deleteTemplateEverywhere: () => "Delete template everywhere",
  shareWithADifferentField: () => "Share with a different field…",
  searchTemplates: () => "Search templates",
  noMatchingTemplates: () => "No matching Templates.",
  allMatchingTemplates: () => "All matching Templates",
  newTemplate: () => "New template",
  templateContent: () => "Template content",
  useFieldContent: () => "Use field content",
  saveForThisFieldOnly: () => "Save for this field only",
  keepsPrivateHint: () => "Keeps this Template private even if this field is shared with others later",
  matchesSimilarPage: () => "This field matches one you already filled in on a similar page:",
  couldNotPreview: () => "The Templates already bound there could not be previewed here.",
  shareTemplatesWith: () => "Share Templates with",
  noOtherFieldsToShareWith: () => "No other Fields available to share with.",
  inThisPage: () => "In this page",
  focusedField: () => "Focused field",
  noOtherFieldsOnPage: () => "No other reliably identified Fields on this page yet.",
  lookingForSimilarFields: () => "Looking for similar Fields…",
  noFieldsMatchSearch: () => "No Fields match this search.",
  back: () => "Back",
  fullText: () => "Full text",
  fullTemplateText: () => "Full template text",
  editTemplateContentLower: () => "Edit template content",

  labelTextField: () => "Text field",
  labelTextFieldNumbered: (ordinal) => `Text field ${ordinal}`,
  labelEmail: () => "Email",
  labelPhone: () => "Phone",
  labelWebsite: () => "Website",
  labelPostalCode: () => "Postal code",
  labelAddress: () => "Address",
  labelFirstName: () => "First name",
  labelLastName: () => "Last name",
  labelName: () => "Name",
  labelHome: () => "Home",
  labelPage: () => "Page",

  looksLikeFilledBefore: () => " · looks like a page you have filled before",
  followingFocus: () => " · following focus",
  keyboardHint: () => "↑↓ move · ⏎ insert",
  nameThisBox: () => "Name this box",

  nameForThisBox: () => "Name for this box",
  nameForField: (label) => `Name for ${label}`,
  renameThisBox: (label) => `Rename this box, currently named "${label}"`,
  renameField: (label) => `Rename "${label}"`,
  renameThisBoxHint: () => "Rename this box. Only you see this name.",
  renameFieldHint: () => "Rename. Only you see this name.",
  confirmMatchExplanation: (templateCount, stopMatchingLabel) =>
    `Confirming makes ${templateCount === 1 ? "this Template" : "these Templates"} available on this field now, and remembers this match for other pages with the same address pattern - you can undo that from Sites > ${stopMatchingLabel} at any time. Other fields on this page stay independent, and nothing is filled in or submitted automatically.`,
  renameHint: () =>
    "Names the box you are typing in. Only you see this name; FillNest shows it wherever it offers this box's Templates.",

  modeSystem: () => "System",
  modeLight: () => "Light",
  modeDark: () => "Dark",
  themeDefault: () => "FillNest Blue",
  themeOcean: () => "Ocean",
  themeForest: () => "Forest",
  themeAmber: () => "Amber",
  themeGraphite: () => "Graphite",
  themePlum: () => "Plum",
  exportBackup: () => "Export Backup",
  exporting: () => "Exporting...",
  backupHeading: () => "Backup",
  backupPrivacyWarning: () => "Privacy warning: a backup is plain text and can contain personal information from your Templates and names. Keep it where you would keep the originals.",

  stopSharingForThisField: () => "Leave sharing for this field",
  deleteNewlyGlobalTemplates: () => "Delete newly Global Templates",
  deleteTemplatesDialog: () => "Delete templates",

  namedThisField: (name) => `Named this field "${name}".`,
  restoredFieldName: (name) => `Restored the field name "${name}".`,
  savedAndBoundToSet: (fieldCount) => `Saved and bound to the Shared Template Set (${fieldCount} fields).`,
  boundToSet: (preview, fieldCount) => `Bound "${preview}" to the Shared Template Set (${fieldCount} fields).`,
  boundToThisField: (preview) => `Bound "${preview}" to this field.`,
  boundToThisFieldOnly: (preview) => `Bound "${preview}" to this field only.`,
  sharedWithWholeSetMerged: (preview, fieldCount) => `Shared "${preview}" with the whole Set (${fieldCount} fields) - merged into the Set\u0027s existing shared entry.`,
  sharedWithWholeSetCount: (preview, fieldCount) => `Shared "${preview}" with the whole Set (${fieldCount} fields).`,
  removedStillShared: (preview) => `Removed "${preview}" from this field · Still shared with the rest of the set.`,
  removedStillUsed: (preview, remaining) => `Removed "${preview}" from this field · Still used in ${remaining} other field${remaining === 1 ? "" : "s"}.`,
  removedNowGlobal: (preview) => `Removed "${preview}" from this field · Now in Global templates.`,
  startedSharingWith: (label) => `Started sharing Templates with ${label}.`,
  startedSharingWithOthers: (count) => `Started sharing Templates between this field and ${count} others.`,
  startedSharingMerged: (label, removed, kept) => `Started sharing Templates with ${label} (merged "${removed}" into "${kept}").`,
  showFullNameOf: (label) => `Show the full name of ${label}`,
  showMore: () => "more…",
  toggleSavedTemplatesFor: (expanded, label) => `${expanded ? "Hide" : "Show"} saved Templates for "${label}"`,
  savedTemplateCount: (count) => `${count} saved Template${count === 1 ? "" : "s"}`,
  savedTemplatesFor: (label) => `Saved Templates for ${label}`,
  locateOnPage: (label) => `Locate "${label}" on page`,
  locateOnPageShort: () => "Locate on page",
  unnamedFieldLabel: () => "this field",
  savedEverywhere: (preview) => `Saved "${preview}" everywhere it is used.`,
  savedForThisFieldMsg: (preview) => `Saved "${preview}" for this field.`,
  savedCopyForSharedCount: (preview, fieldCount) => `Saved a copy of "${preview}" for ${fieldCount} shared fields.`,
  savedCopyForThisField: (preview) => `Saved a copy of "${preview}" for this field.`,
  savedForThisFieldOnlyMsg: (preview) => `Saved "${preview}" for this field only.`,
  deletedFromLibrary: (preview) => `Deleted "${preview}" from your library.`,
  deletedFromFieldsAndLibrary: (preview, fieldCount) => `Deleted "${preview}" from ${fieldCount} field${fieldCount === 1 ? "" : "s"} and your library.`,
  undoLabel: (action, preview) => `Undo ${action} — "${preview}"`,
  undoActionDelete: () => "delete",
  undoActionBind: () => "bind",
  undoActionUnbind: () => "unbind",
  undoActionShare: () => "share",
  undoActionCopy: () => "copy",
  undoActionSharedCopy: () => "shared copy",
  undoActionRemove: () => "remove",
  undoActionCreate: () => "create",
  undoActionEdit: () => "edit",
  mergedWith: (name) => `Merged with "${name}".`,
  sharedWithWholeSet: (preview) => `Shared "${preview}" with the whole Set.`,
  sharedWithSet: (preview) => `Shared "${preview}" with the Set.`,
  sharedMerged: (preview, removed) => `Shared "${preview}" - merged "${removed}".`,
  savedCopyForSharedFields: (preview) => `Saved a copy of "${preview}" for the shared fields.`,
  removedFromThisField: (preview) => `Removed "${preview}" from this field.`,
  looksLikeSameField: (label) => `"${label}" looks like the same field. Share Templates between them?`,
  looksLikeSameEditor: (count) => `${count} fields you use on this site look like the same editor. Share Templates between them?`,
  sharedSetFieldCount: (count) => `Shared Template Set · ${count} fields`,
  insertTitleRepeated: (count) => `Insert this Template into the field. Already inserted ${count} times into this field`,

  addressesNotRemoved: (count) => `${count} address${count === 1 ? "" : "es"} could not be removed.`,
  templatesNowGlobal: (count) => `${count} Template${count === 1 ? " is" : "s are"} now Global. Delete ${count === 1 ? "it" : "them"} if you no longer need ${count === 1 ? "it" : "them"}.`,
  tabsNotUpdated: (count) => `${count} tab(s) could not be updated live and may need to be reloaded.`,
  charactersTooMany: (count) => `About ${count} characters too many`,
  charactersLeft: (count) => `About ${count} characters left`,
  clearedSiteData: (count) => `Cleared site data for ${count} Site${count === 1 ? "" : "s"}.`,
  deletedFromLibraryAndFields: (preview, fieldCount) => `Deleted "${preview}" from the Library and ${fieldCount} Field${fieldCount === 1 ? "" : "s"}`,
  deletedCountFromLibraryAndFields: (count, fieldCount) => `Deleted ${count} Template${count === 1 ? "" : "s"} from the Library and ${fieldCount} Field${fieldCount === 1 ? "" : "s"}`,
  deletedNewlyGlobal: (count) => `Deleted ${count} newly Global Template${count === 1 ? "" : "s"}.`,
  endedSet: (setName, memberCount) => `Ended "${setName}" - ${memberCount} field${memberCount === 1 ? "" : "s"} kept every Template they offered.`,
  madeOwnVersionAgain: (preview) => `Made "${preview}" this Field\u0027s own version again.`,
  removeSiteFilter: (siteId) => `Remove Site filter ${siteId}`,
  removedFromThisFieldShort: (preview) => `Removed "${preview}" from this Field`,
  removedAccessAndData: (count) => `Removed Website Access and cleared saved data for ${count} address${count === 1 ? "" : "es"}.`,
  removedCopyForShared: (preview) => `Removed the copy of "${preview}" made for the shared Fields.`,
  removedCopyForThisField: (preview) => `Removed the copy of "${preview}" made for this Field.`,
  restoredToLibrary: (preview) => `Restored "${preview}" to the Library.`,
  restoredToThisField: (preview) => `Restored "${preview}" to this Field.`,
  restoredTemplates: (count) => `Restored ${count} Template${count === 1 ? "" : "s"}.`,
  restoredPreviousVersion: (preview) => `Restored the previous version of "${preview}".`,
  savedEverywhereShort: (preview) => `Saved "${preview}" everywhere it is used`,
  savedCopyForSharedShort: (preview) => `Saved a copy of "${preview}" for the shared Fields`,
  savedCopyForThisFieldShort: (preview) => `Saved a copy of "${preview}" for this Field`,
  selectForDeletion: (preview) => `Select "${preview}" for deletion`,
  sharedWithWholeSetShort: (preview) => `Shared "${preview}" with the whole Set`,
  stoppedMatching: (origin, routePattern) => `Stopped matching ${origin}${routePattern}.`,
  stoppedSharingSetEnded: (fieldLabel, setName) => `${fieldLabel} left sharing - "${setName}" ended since it had no other members.`,
  stoppedSharingInSet: (fieldLabel, setName) => `${fieldLabel} left "${setName}".`,
  viewAffectedTemplates: (count) => `View ${count} affected Template${count === 1 ? "" : "s"} →`,

  templatesCouldNotBeRestored: (failed, total, reasons) =>
    `${failed} of ${total} Templates could not be restored: ${reasons}`,

  languageHeading: () => "Language",
  languageDescription: () => "Choose a language.",
  languageSystem: () => "System",
  pageButtonHeading: () => "FillNest button on pages",
  pageButtonDescription: () =>
    "The FillNest button in the corner of a web page. If you moved it and cannot find it, put it back in the bottom-right corner.",
  movePageButtonToCorner: () => "Move to bottom right",
  pageButtonMovedToCorner: () => "The FillNest button is back in the bottom-right corner of every page.",
  languageName: () => "English",
  resetComplete: () => "FillNest was reset to its initial state.",
  resetFailed: () => "Failed to reset FillNest.",
  exportBackupFailed: () => "Failed to export backup.",
  backupTooLarge: () => "The selected file exceeds the maximum allowed backup size.",
  readBackupFailed: () => "Failed to read backup file.",
  backupRestored: () => "Backup successfully restored.",
  restoreBackupFailed: () => "Failed to restore backup.",
  validatingBackup: () => "Validating...",
  restoreEllipsis: () => "Restore...",
  resetting: () => "Resetting...",
  restoring: () => "Restoring...",
  restoreData: () => "Restore Data",
  pickerPositionSavedValue: () => "Saved",
  pickerPositionDefaultValue: () => "Default",
  unknownCount: () => "Unknown",
  dormantWebsitePreferencesNote: (count) => `${count} website preference${count === 1 ? "" : "s"} in this backup will remain dormant until Website Access is granted.`,
  emptyTemplate: () => "Empty Template",
  deleteTemplatesEverywhereQuestion: (count) => `Delete ${count} Template${count === 1 ? "" : "s"} everywhere?`,
  removesWholeLibrary: () => "This removes your entire Template Library.",
  affectedLocationsToggle: (expanded, bindingCount) => `${expanded ? "Hide" : "Show"} affected locations (${bindingCount} binding${bindingCount === 1 ? "" : "s"})`,
  impactSites: (list) => `Sites: ${list}`,
  impactPages: (list) => `Pages: ${list}`,
  impactFields: (list) => `Fields: ${list}`,
  noneListed: () => "None",
  savedForThisFieldOnlyShort: () => "Saved for this Field only",
  removedOverrideForThisField: () => "Removed the Override made for this Field only.",
  templateNoLongerSharedWithThisField: () => "This Template is no longer shared with this field.",
  siteFilterCount: (count) => `${count} Sites`,
  viewThisTab: () => "This tab",
  viewAllTemplates: () => "All templates",
  viewByLocation: () => "By location",
  viewSharedSets: () => "Shared Sets",
  sharedSetSummary: (fieldCount, templateCount, siteCount) =>
    `${fieldCount} field${fieldCount === 1 ? "" : "s"} · ${templateCount} Template${templateCount === 1 ? "" : "s"} · ${siteCount} Site${siteCount === 1 ? "" : "s"}`,
  sharedTemplatesHeading: () => "Shared Templates - every field in the Set offers these",
  setFieldsHeading: () => "Fields",
  memberUsesEverything: () => "Uses every shared Template",
  memberOwnVersion: (basePreview, ownPreview) => `Own version of "${basePreview}": "${ownPreview}"`,
  memberDoesNotUse: (preview) => `Doesn't use "${preview}"`,
  memberOnlyThisField: (preview) => `Only this field: "${preview}"`,
  noSharedSets: () =>
    "No Shared Sets yet. To create one, open FillNest next to a field on a web page and choose Share with….",
  renameSetNamed: (setName) => `Rename Set ${setName}`,
  tipsHeading: () => "Getting started",
  gotIt: () => "OK",
  hideTheseTips: () => "OK, hide these tips",
  hideThisTip: () => "OK, hide this tip",
  tipRegion: () => "Tip",
  popupTipAllow: () => "Choose [Allow access] to let FillNest work on this site.",
  pickerTipCreate: () => "Start by creating a Template.",
  enableFillNest: () => "Enable FillNest",
  enableFillNestDescription: () => "When off, FillNest pauses on every site; your Templates and settings are kept.",
  enableOnThisSite: () => "Enable on this site",
  enableOnThisSiteDescription: () => "Affects only this site; other sites are unchanged.",
  statusPageUnsupported: () => "FillNest can't be used on this page.",
  statusNeedsAccess: () => "Not ready yet: choose [Allow access].",
  statusNeedsGlobal: () => "Not ready yet: turn on Enable FillNest.",
  statusNeedsSite: () => "Not ready yet: turn on Enable on this site.",
  statusNeedsReload: () => "Reload this page to start using FillNest.",
  statusReady: () => "Ready to use on this site.",
  confirmShowTipsAgain: () => "Show all tips again? Tips you closed will appear again.",
  showTipsAgainAction: () => "Show again",
  feedbackHeading: () => "Problems or ideas",
  feedbackDescription: () => "Ran into a problem, or have an idea? Email us - every message is read.",
  showFieldsBefore: (count) => `Show the ${count} field${count === 1 ? "" : "s"} before`,
  allowAccess: () => "Allow access",
  undoUseFieldContent: () => "Undo",
  usedFieldContent: () => "Replaced with the field's content.",
  pickerTipInsert: () => "Click a Template to insert it into the field.",
  pickerTipManage: () => "Every Template can be edited, searched and shared.",
  noteThisTab: () => "Templates saved on this page, and their fields.",
  noteAllTemplates: () => "All Templates: search, filter, delete in bulk.",
  noteByLocation: () => "Filed by site › page › field.",
  noteSharedSets: () => "Fields that share Templates. Create with Share with… in the Picker.",
  noteSites: () => "Pause, clear or remove a site.",
  noteShareWith: () => "Chosen fields will share Templates. Leave any time.",
  showTipsAgain: () => "Show tips again",
  tipsHeadingSettings: () => "Tips",
  tipsDescription: () => "The getting-started cards and page notes.",
  tipsWillShowAgain: () => "Tips will show again.",
  copyEmail: () => "Copy email",
  copyEmailLabel: (address) => `Copy email ${address}`,
  emailCopied: () => "Copied.",
  emailNotCopied: () => "Could not copy. Select the address instead.",
  leaveSharingFor: (fieldLabel) => `Leave sharing for ${fieldLabel}`,
  shareVersionWithSetQuestion: (preview, memberCount, setName) => ["Share ", { strong: preview }, ` with the whole Shared Template Set? It becomes available to all ${memberCount} field${memberCount === 1 ? "" : "s"} in `, { strong: setName }, "."],
  privateVersionMergesIntoShared: () => "This field's separate private version is merged into the Set's existing shared entry for this Template.",
  searchTemplateBodiesEllipsis: () => "Search Template bodies…",
  siteUnionHint: (siteCount, matchCount) => `Showing Templates from any of ${siteCount} Sites (union) — ${matchCount} match${matchCount === 1 ? "" : "es"}.`,
  sortAscending: () => "↑ Ascending",
  sortDescending: () => "↓ Descending",
  hideFullTemplateText: () => "Hide the full Template text",
  showFullTemplateText: () => "Show the full Template text",
  templatesWaitingForField: (count) => `${count} template${count === 1 ? "" : "s"} waiting for a Field`,
  expandOrCollapseNamed: (expanded, label) => `${expanded ? "Collapse" : "Expand"} "${label}"`,
  renameNamed: (label) => `Rename ${label}`,
  statusAll: () => "All",
  unknownField: () => "Unknown field",
  invalidResult: () => "FillNest returned an invalid result.",
  undidStopSharing: () => "Undid Leave sharing.",
  undidEndSet: () => "Undid ending the Shared Template Set.",
  selectAllFilteredAddresses: () => "Select all filtered addresses",
  selectedOfTotal: (selected, total) => `${selected} of ${total} selected`,
  fieldOptionCount: (count) => `${count} option${count === 1 ? "" : "s"}`,
  selectedCount: (count) => `${count} selected`,
  noTemplatesMatchSearch: () => "No Templates match this Search.",
  addressRange: (first, last, total) => `${first}–${last} of ${total}`,
  moreTemplatePreviews: (count) => `(+${count} more)`,
  actionIsAvailable: (label) => `${label} is available.`,
  templateLengthDetail: (used, max, wideCharacters, letters) =>
    `${used} of ${max}. Template length used. A Chinese character counts as three, so the limit is about ${wideCharacters} Chinese characters or ${letters} letters.`,
  noTemplatesInSetYet: () => "No Templates in this Shared Template Set yet.",
  setMembers: (setName) => `${setName} members`,
  selectOrigin: (origin) => `Select ${origin}`,
  expandOrCollapseOrigin: (expanded, origin) => `${expanded ? "Collapse" : "Expand"} ${origin}`,
  originAccess: (origin) => `${origin} access`,
  siteTemplatesLink: (count) => `${count} Template${count === 1 ? "" : "s"} →`,
  deleteAllNewlyGlobalQuestion: (count) => `Delete all ${count} newly Global Templates?`,
  removeSitesQuestion: (count) => `Remove ${count} Site${count === 1 ? "" : "s"}?`,
  openTemplatesLink: () => "Open Templates →",
  endSetQuestion: (setName) => `End "${setName}"?`,
  endSetBody: (memberCount) => `${memberCount} field${memberCount === 1 ? "" : "s"} stop sharing this Template list. Each field keeps every Template it offers now, as its own; Templates themselves stay in your library and are not deleted.`,
  stopSharingForQuestion: (fieldLabel) => `Leave sharing for ${fieldLabel}?`,
  stopSharingBody: (fieldLabel, setName) => `${fieldLabel} leaves "${setName}" and keeps every Template it offers now, as its own; the rest of the set is unaffected.`,
  clearSiteDataQuestion: (count) => `Clear site data for ${count} Site${count === 1 ? "" : "s"}?`,
  clearSiteDataBody: (pages, fields, bindings, pageAliases, fieldAliases) => `FillNest forgets the fields it recognized here and which Templates were bound to them: ${pages} page${pages === 1 ? "" : "s"}, ${fields} field${fields === 1 ? "" : "s"}, and ${bindings} binding${bindings === 1 ? "" : "s"} (including ${pageAliases} page alias${pageAliases === 1 ? "" : "es"} and ${fieldAliases} field alias${fieldAliases === 1 ? "" : "es"}).`,
  clearSiteDataStopsRules: (count) => `This also stops ${count} Logical Page Matching rule${count === 1 ? "" : "s"} confirmed here.`,
  clearSiteDataLeavesSets: (count) => `This also removes this Site from ${count} Shared Template Set${count === 1 ? "" : "s"}; a Set only ends entirely if no linked Field remains on another Site. Shared Templates stay in your library either way.`,
  clearSiteDataAffinities: (count, siteList) => `This also removes the selected Site from ${count} Template${count === 1 ? "" : "s"}. Templates with no remaining Site become Global; Templates stay in your library and Website Access is not affected. This covers every address of ${siteList}, including any you did not select.`,
  removedFromFieldRemainsElsewhere: (preview, remaining) => `Removed "${preview}" from this Field; it remains on ${remaining} other Field${remaining === 1 ? "" : "s"}`,
  removedFromFieldNowGlobal: (preview) => `Removed "${preview}" from this Field; it is now Global`,
  filterBySiteCurrent: (label) => `Filter by Site: ${label}`,
  thisPageLabel: () => "This page",
  actionFailed: () => "FillNest action failed",
  savedFieldOnlyStaysPrivate: () => "Saved for this field only · It stays private if this field is shared later.",
  savedAndBound: () => "Saved and bound to this field.",
  savedForThisFieldOnly: () => "Saved for this field only.",
  stoppedSharingOwnAvailable: () => "This field left sharing. It keeps every Template it offered, as its own.",
  mergedSetsAndShared: (preview, fieldLabel, removedSet, set, combined) => `Shared "${preview}" with ${fieldLabel} - merged "${removedSet}" into "${set}"${combined ? ", combined into the Set's existing shared entry" : ""}.`,
  joinedAndShared: (preview, fieldLabel, combined) => `Shared "${preview}" with ${fieldLabel}${combined ? ", combined into the Set's existing shared entry" : ""}.`,
  mayHaveDifferentPurpose: () => "may have a different purpose.",
  templateNoLongerSharedWithCurrentField: () => "This Template is no longer shared with the current field.",
  undoSharing: () => "Undo sharing",
  undoAddField: () => "Undo add field",
  undoStopSharing: () => "Undo Leave sharing",
  undoMerge: () => "Undo merge",
  undoSaveForThisField: () => "Undo save for this field",
  undoneOutcome: (undoLabel) => `Undid ${undoLabel.replace(/^Undo /u, "").replace(/ —.*$/u, "")}.`,
  reusedExistingTemplates: () => "Reused your existing Templates for this page.",
  sharedThisFieldsTemplates: () => "Shared this field's Templates.",
  addedFieldToSharedSet: () => "Added a field to the Shared Template Set.",
  stoppedSharingForThisField: () => "This field left sharing.",
  deletedQuoted: (preview) => `Deleted "${preview}".`,
  savedQuoted: (preview) => `Saved "${preview}".`,
  keepOpen: () => "Keep open",
  turnOffKeepOpen: () => "Turn off Keep open",
  sharedStatus: (count) => `· Shared · ${count} field${count === 1 ? "" : "s"} use the same Templates`,
  repeatInsertNotice: (name, count) => `Inserted "${name}" ${count} times into this field.`,
  bindToSetQuestion: (preview, setName, count) => ["Bind ", { strong: `"${preview}"` }, " to Shared Template Set ", { strong: setName }, `? It becomes available to all ${count} field${count === 1 ? "" : "s"} in the Set.`],
  shareQuotedWithSetQuestion: (preview, count, setName) => ["Share ", { strong: `"${preview}"` }, ` with the whole Shared Template Set? It becomes available to all ${count} field${count === 1 ? "" : "s"} in `, { strong: setName }, "."],
  noTemplatesInSharedSetYet: () => "No templates in this Shared Template Set yet.",
  noTemplatesBoundToField: () => "No templates bound to this field.",
  noSavedMatchForField: () => "No saved match for this field. Create a Template or Search existing Templates.",
  thisFieldHeading: () => "This field",
  shareTemplatesWithQuestion: (fieldLabel, fieldCount, siteCount) => ["Share Templates with ", { strong: fieldLabel }, `? Every Template these ${fieldCount} field${fieldCount === 1 ? "" : "s"} across ${siteCount} Site${siteCount === 1 ? "" : "s"} currently offer becomes available to all of them. Templates you saved for one field only stay private to that field.`],
  mergeSetsAndShareQuestion: (preview, fieldLabel, fieldCount, siteCount) => ["Merge Shared Template Sets and share ", { strong: `"${preview}"` }, " with ", { strong: fieldLabel }, `? This affects ${fieldCount} field${fieldCount === 1 ? "" : "s"} across ${siteCount} Site${siteCount === 1 ? "" : "s"} - every ordinary shared Template already in either Set becomes available to all of them.`],
  joinSetAndShareQuestion: (fieldLabel, setName, preview, fieldCount) => ["Add ", { strong: fieldLabel }, " to ", { strong: setName }, " and share ", { strong: `"${preview}"` }, ` with the Set? This affects ${fieldCount} field${fieldCount === 1 ? "" : "s"} - every ordinary shared Template already in the Set becomes available to ${fieldLabel} too.`],
  afterwardsOverLimit: (count, max) => ["Afterwards each of these fields offers ", { strong: `${count} Templates` }, `, more than the ${max} FillNest normally keeps on one field. You can still do this; you just will not be able to add more until some are removed.`],
  afterwardsWithinLimit: (count, max) => ["Afterwards each of these fields offers ", { strong: `${count} of ${max}` }, " Templates."],
  mergeSetsAndShare: () => "Merge Sets & Share",
  joinSetAndShare: () => "Join Set & Share",
  searchFieldsLabel: () => "Search Fields",
  searchFieldsToShareWith: () => "Search Fields to share with",
  searchFieldsToShareTemplateWith: () => "Search Fields to share this Template with",
  searchFieldsAcrossPages: () => "Search fields on other pages",
  showAllOtherFields: (count) => `Show all ${count} other Field${count === 1 ? "" : "s"}`,
  insertThisTemplate: () => "Insert this Template into the field",
  siteAffinityBadge: (primarySite, otherCount) => `Site Affinity ${primarySite}${otherCount > 0 ? ` plus ${otherCount} more` : ""}`,
  fieldTemplateLimit: (max) =>
    `This field already offers ${max} Templates, which is the most FillNest keeps on one field. Remove one from this field before adding another.`,
  setTemplateLimit: (max) =>
    `One of the fields in this set already offers ${max} Templates, which is the most FillNest keeps on one field. Remove one from the set before adding another.`,
  templateTooLong: (wideCharacters, letters) =>
    `This Template is too long. A Template holds about ${wideCharacters.toLocaleString("en-US")} Chinese characters, or about ${letters.toLocaleString("en-US")} letters. Shorten it, or split it into two Templates.`,
  errorStaleUndo: () => "This can no longer be undone - something changed since.",
  errorStaleImpact: () => "The affected counts changed since you reviewed them. Review the updated counts, then try again.",
  errorStalePageMatch: () => "This page match has changed, so this could not be done. Close FillNest and open it again, then retry.",
  errorInconsistentData: () =>
    "FillNest did not make this change: its saved data would have failed its own consistency check. Nothing was changed.",
  errorBackupInvalid: () => "The backup file is invalid or corrupted.",
  errorBackupTooLarge: () => "The backup file exceeds the maximum allowed size limit.",
  errorRestorePreviewStale: () =>
    "The library, settings, or target backup changed since the restore preview was generated. Review the updated preview before restoring.",
  errorRestoreRecoveryBlocked: () =>
    "A restore could not finish, so FillNest has stopped to keep your previous data safe. Restart the browser to try putting it back, or use Reset FillNest in Settings to start over - that deletes all FillNest data.",
  errorResetPreviewStale: () =>
    "FillNest data or Website Access changed since the reset preview. Review the updated preview before resetting.",
  errorResetIncomplete: () => "Reset could not remove every Website Access. Local data has been kept. Retry Reset to continue.",
  errorRemoveSiteIncomplete: () =>
    "Chrome could not remove every selected Website Access permission. Your saved Site data was restored.",
  errorConfirmationMismatch: () => "The confirmation word does not match. Type it exactly as shown.",
};
