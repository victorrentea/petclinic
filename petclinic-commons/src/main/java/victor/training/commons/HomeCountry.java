package victor.training.commons;

/** What a national number (no {@code +} or {@code 00}) is dialled from: only the calling app knows. */
public interface HomeCountry {
    String homeDialCode();
}
