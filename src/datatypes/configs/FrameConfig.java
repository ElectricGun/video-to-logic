package datatypes.configs;

import arc.math.geom.*;

public class FrameConfig {
    public float tolerance = 0f;
    public int minPixelSize = 1;
    public Vec2 pixelStep = new Vec2(1, 1);
    public int maxThreads = 1;
    public Vec2 newSize = new Vec2(1, 1);

    @Override
    public String toString() {
        return "FrameConfig{" +
                "tolerance=" + tolerance +
                ", minPixelSize=" + minPixelSize +
                ", pixelStep=" + pixelStep +
                ", maxThreads=" + maxThreads +
                ", newSize=" + newSize +
                '}';
    }
}
