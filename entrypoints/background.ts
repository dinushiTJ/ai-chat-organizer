export default defineBackground(() => {
  async function enableSidePanel() {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }

  void enableSidePanel();

  chrome.runtime.onInstalled.addListener(() => {
    void enableSidePanel();
  });

  // Explicitly open the panel as a fallback for Chrome versions where the
  // action-click behavior is not applied until the next extension install.
  chrome.action.onClicked.addListener((tab) => {
    if (tab.windowId !== undefined) {
      void chrome.sidePanel.open({ windowId: tab.windowId });
    }
  });
});
