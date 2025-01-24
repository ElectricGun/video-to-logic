package ui.tables;

import arc.scene.ui.layout.Table;

public class BaseTable extends Table {

    protected Runnable runnableOnUpdate;

    public void onUpdate(Runnable r) {
        runnableOnUpdate = r;
    }
}
