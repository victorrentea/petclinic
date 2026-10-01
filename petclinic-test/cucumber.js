module.exports = {
  default: {
    requireModule: ['ts-node/register'],
    require: ['src/support/world.ts', 'src/**/*.glue.ts'],
    paths: ['src/**/*.feature'],
    // @wip: a scenario that states a rule before the code enforces it (visit-date-range,
    // issue #40). It stays readable in the repo and out of the run until the fix lands.
    tags: 'not @wip',
    format: ['progress'],
    publishQuiet: true,
  },
};
