module.exports = {
  default: {
    requireModule: ['ts-node/register'],
    require: ['src/support/world.ts', 'src/**/*.glue.ts'],
    paths: ['src/**/*.feature'],
    // @wip: a scenario that states a rule before the code enforces it; it stays out of the run.
    tags: 'not @wip',
    format: ['progress'],
    publishQuiet: true,
  },
};
