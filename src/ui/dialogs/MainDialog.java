package ui.dialogs;

import arc.scene.ui.*;
import arc.scene.ui.layout.Table;
import mindustry.gen.Tex;
import mindustry.ui.dialogs.BaseDialog;
import ui.tables.InterfaceTable;
import ui.tables.ProcessesTable;

import static resources.SessionData.*;

public class MainDialog extends BaseDialog {

    protected final Table table = new Table();

    protected final InterfaceTable interfaceTable = new InterfaceTable();
    protected final ProcessesTable processesTable = new ProcessesTable();

    ScrollPane processesScrollPane = new ScrollPane(processesTable);

    public MainDialog(String title) {
        super(title);

        shouldPause = false;
        addCloseButton();

        cont.add(table).grow();

        processesScrollPane.setScrollingDisabled(true, false);
        processesScrollPane.setFadeScrollBars(false);

        interfaceTable.background(Tex.pane);
        processesTable.background(Tex.pane);

        build();
    }

    public void build() {

        table.clear();
        interfaceTable.build();
        processesTable.build();

        interfaceTable.onUpdate(() -> build());

        // add elements
        table.add(interfaceTable).grow().left();
        if (getSelectedFile() != null) {
            table.add(processesScrollPane).grow().left();
        }
    }


    @Override
    public Dialog show() {
        return super.show();
    }
}
