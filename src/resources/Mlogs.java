package resources;

public class Mlogs {

    public static String color(float r, float g, float b, float a) {
        return "draw color " + r + " " + g + " " + b + " " + a + "\n";
    }

    public static String rect(float x, float y, float width, float height) {
        return "draw rect " + x + " " + y + " " + width + " " + height + "\n";
    }

    public static String drawflush(String display) {
        return "drawflush " + display + "\n";
    }

    public static String wait(float time) {
        return "wait " + time + "\n";
    }

    public static String jump(String label, String comparator, String variable, String conditional) {
        return "jump " + label + " " + comparator + " " + variable + " " + conditional + "\n";
    }

    public static String jumpAlways(String label) {
        return "jump " + label + " " + Comparators.always + "\n";
    }

    public static String read(String variable, String cell, int position) {
        return "read " + variable + " " + cell + " " + position + "\n";
    }

    public static String write(String variable, String cell, String position) {
        return "write " + variable + " " + cell + " " + position + "\n";
    }

    public static class Comparators {
        public static String
            notEqual = "notEqual",
            equal = "equal",
            lessThan = "lessThan",
            lessThanEq = "lessThanEq",
            greaterThanEq = "greaterThanEq",
            strictEqual = "strictEqual",
            always = "always"
                    ;
    }
}

//jump -1  x false
//jump -1 equal x false
//jump -1 lessThan x false
//jump -1 lessThanEq x false
//jump -1 greaterThan x false
//jump -1 greaterThanEq x false
//jump -1 strictEqual x false
//jump -1 always x false
//set result 0
//op add result a b