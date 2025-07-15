package datatypes.mlog;

import datatypes.errors.*;
import resources.*;

public class MlogImage extends Mlog {

    public String display;
    public int drawBufferSize;

    protected float[] currentColor = new float[4];

    protected int draws = 0;
    protected boolean alreadyFlushed = false;

    int maxImageLength;

    public MlogImage(String display, int maxLength, int drawBufferSize) {
        this(display, maxLength, drawBufferSize, drawBufferSize);
    }

    public MlogImage(String display, int maxLength, int drawBufferSize, int maxImageLength) {
        super(maxLength);
        this.drawBufferSize = drawBufferSize;
        this.maxImageLength = maxImageLength;
        this.display = display;
    }

    public boolean isDrawFull() {
        return length >= maxImageLength;
    }

    protected void addDraw(String instruction) throws MlogOverflowException {
        if (length + 1 > maxImageLength) throw new MlogOverflowException("Maximum image length reached!");

        if (draws + 1 > drawBufferSize) {
            drawflush();
            color(currentColor[0], currentColor[1], currentColor[2], currentColor[3]);
            alreadyFlushed = true;
        } else {
            alreadyFlushed = false;
        }
        newInstruction(instruction);
        draws++;
    }

    public void color(float r, float g, float b, float a) throws MlogOverflowException {
        currentColor[0] = r;
        currentColor[1] = g;
        currentColor[2] = b;
        currentColor[3] = a;

        addDraw(Mlogs.color(r, g, b, a));
    }

    public void rect(float x, float y, float width, float height) throws MlogOverflowException {
        addDraw(Mlogs.rect(x, y, width, height));
    }

    public void drawflush() throws MlogOverflowException {
        newInstruction(Mlogs.drawflush(display));
        draws = 0;
    }

    public void endImage() throws MlogOverflowException {
        if (!alreadyFlushed)
            drawflush();
    }
}
