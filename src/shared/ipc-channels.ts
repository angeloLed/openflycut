export const IPC = {
  HistoryGetAll: 'history:getAll',
  HistorySelectItem: 'history:selectItem',
  HistoryPinItem: 'history:pinItem',
  HistoryDeleteItem: 'history:deleteItem',
  HistoryClearAll: 'history:clearAll',
  HistoryChanged: 'history:changed',
  PopupHide: 'popup:hide',
  SettingsGet: 'settings:get',
  SettingsUpdate: 'settings:update',
  AppGetVersion: 'app:getVersion',
  AppGetPlatform: 'app:getPlatform'
} as const
