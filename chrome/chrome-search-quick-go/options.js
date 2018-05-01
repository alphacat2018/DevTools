// Based on https://developer.chrome.com/extensions/optionsV2

const flashMessage = (message) => {
  // Update status to let user know.
  const status = document.getElementById('status');
  status.textContent = message;
  setTimeout(function() {
    status.textContent = '';
  }, 3000);
};

// Saves options to chrome.storage.sync.
const saveOptions = () => {
  const values = {
    wrapNavigation: document.getElementById('wrap-navigation').checked,
    autoSelectFirst: document.getElementById('auto-select-first').checked,
    nextKey: document.getElementById('next-key').value,
    previousKey: document.getElementById('previous-key').value,
    navigateNewTabKey: document.getElementById('navigate-new-tab-key').value,
    navigateNewTabBackgroundKey: document.getElementById('navigate-new-tab-background-key').value,
  };
  for (let key in values) {
    extension.options.sync.values[key] = values[key];
  }
  return extension.options.sync.save().then(
    () => flashMessage('Options saved.'),
    () => flashMessage('Error when saving options.')
  );
};

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
const restoreOptions = () => {
  extension.options.sync.load().then(() => {
    const values = extension.options.sync.values;
    document.getElementById('wrap-navigation').checked =
      values.wrapNavigation;
    document.getElementById('auto-select-first').checked =
      values.autoSelectFirst;
    document.getElementById('next-key').value =
      values.nextKey;
    document.getElementById('previous-key').value =
      values.previousKey;
    document.getElementById('navigate-new-tab-key').value =
      values.navigateNewTabKey;
    document.getElementById('navigate-new-tab-background-key').value =
      values.navigateNewTabBackgroundKey;
  });
};

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
