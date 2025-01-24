package datatypes.mlog;

import datatypes.errors.MlogOverflowError;
import mindustry.logic.LExecutor;

import java.util.ArrayList;
import java.util.List;

public class Mlog {

    protected List<String> variables = new ArrayList<>();

    protected int length = 0;
    protected String code = "";

    public int maxLength;

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

    public Mlog newInstruction(String instruction) throws MlogOverflowError {
        if (length + 1 > maxLength) throw new MlogOverflowError("Maximum mlog length reached!");

        if (!instruction.endsWith("\n"))
            instruction += "\n";

        code += instruction;
        length ++;

        return this;
    }
}
