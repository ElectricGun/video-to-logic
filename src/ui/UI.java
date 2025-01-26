package ui;

import arc.Core;
import arc.scene.style.TextureRegionDrawable;
import arc.scene.ui.layout.Table;
import resources.SessionData;
import ui.dialogs.ErrorDialog;

import static resources.Dialogs.*;


import static mindustry.Vars.ui;

public class UI {
    public static ErrorDialog errorDialog;

    public static void setupUI()  {

        setupButtons();
        errorDialog = new ErrorDialog("@video-to-logic-unsupported");

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
                try {
                    SessionData.assertCorrectPlatform();
                    testDialog.show();
                } catch (Exception e) {
                    UI.errorDialog.show();
                }
            });
        });
    }
}
