package datatypes;

import arc.graphics.Color;

// datatype for quadtree compression
public class ColorNode {
    public Color color;
    public int width;
    public int height;

    public int x;
    public int y;

    public ColorNode(Color color, int x, int y, int width, int height) {
        this.width = width;
        this.height = height;
        this.color = color;
        this.x = x;
        this.y = y;
    }

    @Override
    public String toString() {
        return "(" + x + ", " + y +")" + "(" + width + "w, " + height +"h)" + color.r + color.g + color.b;
    }
}
