package datatypes.configs;

import mindustry.world.Block;

public class MediaProcessConfig extends FrameConfig{
    public int startFrame;
    public int endFrame;
    public int frameStep = 1;
    public boolean isImage = false;

    public Block processor;

    public MediaProcessConfig(int start, int end) {
        startFrame = start; endFrame = end;
    }

    @Override
    public String toString() {
        return "MediaProcessConfig{" +
                "startFrame=" + startFrame +
                ", endFrame=" + endFrame +
                ", frameStep=" + frameStep +
                ", isImage=" + isImage +
                ", tolerance=" + tolerance +
                ", minPixelSize=" + minPixelSize +
                ", pixelStep=" + pixelStep +
                ", maxThreads=" + maxThreads +
                ", newSize=" + newSize +
                '}';
    }
}
