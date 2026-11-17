package victor.training.petclinic.repository;

/**
 * One allow-listed sort of the owners list. The ORDER BY text is built only from the constants
 * here, never from the request. Names and cities are compared case-insensitively in Romanian
 * alphabetical order; the collation is required, with no fallback to the database default.
 */
public record OwnerSort(Field field, boolean ascending) {
    private static final String ROMANIAN = "COLLATE \"ro-RO-x-icu\"";

    public enum Field {
        LAST_NAME("lastName", "last_name", "first_name"), CITY("city", "city");

        private final String apiName;
        private final String[] columns;

        Field(String apiName, String... columns) {
            this.apiName = apiName;
            this.columns = columns;
        }

        public String apiName() {
            return apiName;
        }
    }

    public static final OwnerSort DEFAULT = new OwnerSort(Field.LAST_NAME, true);

    String orderBy() {
        String direction = ascending ? "ASC" : "DESC";
        StringBuilder orderBy = new StringBuilder();
        for (String column : field.columns) {
            orderBy.append("lower(").append(column).append(") ").append(ROMANIAN)
                    .append(' ').append(direction).append(" NULLS LAST, ");
        }
        return orderBy.append("id ASC").toString();
    }
}
