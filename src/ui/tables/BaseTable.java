package ui.tables;

import arc.scene.ui.layout.*;

public class BaseTable extends Table {

    protected Runnable runnableOnUpdate;

    public void onUpdate(Runnable r) {
        runnableOnUpdate = r;
    }
}
