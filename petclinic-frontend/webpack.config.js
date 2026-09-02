module.exports = {
  ignoreWarnings: [
    // Transitive via @opentelemetry/api → protobufjs uses dynamic require
    // for an internal "inquire" loader that webpack can't statically resolve.
    // The dynamic path is dead code in our usage; safe to suppress.
    { module: /protobufjs[\\/]+inquire/ },
  ],
};
