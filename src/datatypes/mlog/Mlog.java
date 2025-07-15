package datatypes.mlog;

import datatypes.errors.*;
import mindustry.logic.*;
import java.util.*;

public class Mlog {

    public int maxLength;

    protected List<String> variables = new ArrayList<>();
    protected int length = 0;
    protected String code = "";

    public Mlog () {
        this.maxLength = LExecutor.maxInstructions;
    }

    public Mlog (int maxLength) {
        this.maxLength = maxLength;
    }

    public String label(String label) {
        code +=  label + ":\n";
        return label;
    }

    public int getCurrentLine() {
        return length -1;
    }

    public int getLength() {
        return length;
    }

    public String getCode() {
        return code;
    }

    public Mlog newInstruction(String instruction) throws MlogOverflowException {
        if (length + 1 > maxLength) throw new MlogOverflowException("Maximum mlog length reached!");

        if (!instruction.endsWith("\n"))
            instruction += "\n";

        code += instruction;
        length ++;

        return this;
    }
}
