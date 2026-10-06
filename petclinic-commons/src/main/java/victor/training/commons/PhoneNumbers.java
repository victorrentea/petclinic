package victor.training.commons;

public final class PhoneNumbers {
    private PhoneNumbers() {
    }

    /** {@code +1 (608) 555-1023} → {@code +16085551023}; a {@code 00} international prefix becomes {@code +}. */
    public static String normalize(String phone) {
        String digits = stripFormatting(phone);
        return digits.startsWith("00") ? "+" + digits.substring(2) : digits;
    }

    /** Like {@link #normalize(String)}, but a national number is given the caller's dial code. */
    public static String normalize(String phone, HomeCountry homeCountry) {
        String normalized = normalize(phone);
        if (normalized.startsWith("+")) {
            return normalized;
        }
        String withoutTrunkPrefix = normalized.startsWith("0") ? normalized.substring(1) : normalized;
        return homeCountry.homeDialCode() + withoutTrunkPrefix;
    }

    private static String stripFormatting(String phone) {
        return phone.replaceAll("[^+\\d]", "");
    }
}
