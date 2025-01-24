package datatypes.mlog;

import datatypes.errors.MlogOverflowError;
import resources.Mlogs;

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

    protected void addDraw(String instruction) throws MlogOverflowError {
        if (length + 1 > maxImageLength) throw new MlogOverflowError("Maximum image length reached!");

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

    public void color(float r, float g, float b, float a) {
        currentColor[0] = r;
        currentColor[1] = g;
        currentColor[2] = b;
        currentColor[3] = a;

        addDraw(Mlogs.color(r, g, b, a));
    }

    public void rect(float x, float y, float width, float height) {
        addDraw(Mlogs.rect(x, y, width, height));
    }

    public void drawflush() {
        newInstruction(Mlogs.drawflush(display));
        draws = 0;
    }

    public void endImage() {
        if (!alreadyFlushed)
            drawflush();
    }
}
