const { GlobalKeyboardListener } = require('node-global-key-listener');
const listener = new GlobalKeyboardListener();
console.log('Listener instantiated. Listening for 5 seconds...');
listener.addListener((e, down) => {
  console.log('Event received:', e.name, e.state);
});
setTimeout(() => {
  console.log('Stopping listener.');
  listener.kill();
  process.exit(0);
}, 5000);
