package ui;

import arc.Core;
import arc.scene.style.TextureRegionDrawable;
import arc.scene.ui.layout.Table;

import static resources.Dialogs.*;


import static mindustry.Vars.ui;

public class UI {
    public static void setupUI()  {
        setupButtons();
    }

    private static void setupButtons() {
        Table statusTable = ui.hudGroup.find("statustable");
        statusTable.row();

        Table table = new Table() {{
            name = "menutable";
        }};

        statusTable.add(table).bottom().left();

        table.table(t -> {


            // unhardcode later
            int size = 80;

            t.button(new TextureRegionDrawable(Core.atlas.find("video-to-logic-java-frog")), size, () -> {

            }).size(size);

            t.clicked(() -> {
                testDialog.show();
            });
        });
    }
}
