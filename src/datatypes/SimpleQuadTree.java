package datatypes;

public class SimpleQuadTree<T> {
    public T data;
    public SimpleQuadTree<T> topLeft, topRight, botLeft, botRight;

    public SimpleQuadTree (T newData) {
        data = newData;
    }
    protected SimpleQuadTree<T> newLeaf(T newData) {
        return new SimpleQuadTree<>(newData);
    }
    public void insertTopLeft (T newData) {
        topLeft = newLeaf(newData);
    }
    public void insertTopRight (T newData) {
        topRight = newLeaf(newData);
    }
    public void insertBotLeft (T newData) {
        botLeft = newLeaf(newData);
    }
    public void insertBotRight (T newData) {
        botRight = newLeaf(newData);
    }
}
