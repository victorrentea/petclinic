module.exports = {
  default: {
    requireModule: ['ts-node/register'],
    require: ['src/support/world.ts', 'src/**/*.glue.ts'],
    paths: ['src/**/*.feature'],
    format: ['progress'],
    publishQuiet: true,
  },
};
