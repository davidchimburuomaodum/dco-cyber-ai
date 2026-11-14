window.dcoAuthReady = Promise.resolve(true);

window.dcoApiFetch = function(url, options = {}) {
  return fetch(url, options);
};
