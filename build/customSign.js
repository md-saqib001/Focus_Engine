exports.default = async function (configuration) {
  console.log(`[Signing Bypass] Skipping code signing for executable: ${configuration.path}`);
};
