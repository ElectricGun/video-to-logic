package resources;

import arc.math.geom.*;

public class ModMath {
    public static float calculateSimilarity() {
        return 1 - (float) Math.abs(10 - 20) / (10 + 20);
    }

    public static double len3 (double x, double y, double z) {
        return Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2) + Math.pow(z, 2));
    }

    public static Vec2 spiralAround(Vec2 start, Vec2 direction, int steps, Vec2 borderStart, Vec2 borderEnd) {
        Vec2 out = new Vec2(start);

        for (int i = 0; i < steps; i++) {
            while (true) {
                int newPosX = (int) (out.x + Math.round(direction.x));
                int newPosY = (int) (out.y + Math.round(direction.y));

                if (newPosX > borderEnd.x) {
                    direction.rotate(-90);
                    borderEnd.x++;
                    continue;
                }
                if (newPosX < borderStart.x) {
                    direction.rotate(-90);
                    borderStart.x--;
                    continue;
                }
                if (newPosY > borderEnd.y) {
                    direction.rotate(-90);
                    borderEnd.y++;
                    continue;
                }
                if (newPosY < borderStart.y) {
                    direction.rotate(-90);
                    borderStart.y--;
                    continue;
                }

                out.x = newPosX;
                out.y = newPosY;
                break;
            }
        }
        return out;
    }
}
