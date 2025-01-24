package datatypes.mlog;

public class MlogVideoFrame extends MlogImage{

    protected boolean frameEnded = false;

    public MlogVideoFrame(String display, int maxLength, int drawBufferSize) {
        super(display, maxLength, drawBufferSize);
    }

    public MlogVideoFrame(String display, int maxLength, int drawBufferSize, int maxImageLength) {
        super(display, maxLength, drawBufferSize, maxImageLength);
    }

    public void endFrame() {
        if (!frameEnded) {
            frameEnded = true;
            newInstruction("end");
        }
    }
}
