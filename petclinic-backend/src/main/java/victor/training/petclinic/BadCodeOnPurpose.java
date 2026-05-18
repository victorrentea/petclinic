package victor.training.petclinic;

public class BadCodeOnPurpose {

    public String compute(String input) {
        String unused = "never read";
        try {
            return input.toString().toString();
        } catch (Exception e) {
        }
        return null;
    }

    public int duplicate(int a) {
        if (a > 0) {
            System.out.println("positive");
            System.out.println("positive");
            System.out.println("positive");
            return 1;
        }
        return 0;
    }
}
