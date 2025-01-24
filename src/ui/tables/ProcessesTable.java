package ui.tables;

import arc.Events;
import arc.scene.ui.Label;
import arc.scene.ui.TextButton;
import arc.scene.ui.layout.Table;
import processes.MediaProcessThread;
import mindustry.game.EventType;
import mindustry.gen.Tex;
import mindustry.ui.Styles;
import resources.SessionData;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class ProcessesTable extends BaseTable {

    Map<MediaProcessThread, Table> frameProcessTables = new HashMap<>();
    Map<MediaProcessThread, Label> labelMap = new HashMap<>();
    Map<MediaProcessThread, Label> frameProgressLabels = new HashMap<>();

    List<MediaProcessThread> finishedProcesses = new ArrayList<>();

    public float width = 200;

    public ProcessesTable() {
        Events.run(EventType.Trigger.update, () -> {
            updateTables();
        });
    }

    protected void updateTables() {
        for (MediaProcessThread thread : SessionData.getThreads()) {
            if (!thread.active()) {
                if (frameProcessTables.containsKey(thread)) {
                    removeChild(frameProcessTables.get(thread));
                    finishedProcesses.remove(thread);
                    frameProcessTables.remove(thread);
                }
                continue;
            }
            if (thread.isFinished() && !finishedProcesses.contains(thread)) {
                finishedProcesses.add(thread);
                build();
            }
            labelMap.get(thread).setText((thread.getProgress() * 100) + "%");
            frameProgressLabels.get(thread).setText(thread.getCurrentFrame() + "/" + thread.getEnd());
        }
    }

    public void build() {
        clear();

        boolean doCreateDummy = true;

        for (MediaProcessThread thread : SessionData.getThreads()) {
            if (!thread.active()) continue;
            doCreateDummy = false;
            table(Tex.pane, t -> {

                t.add(new Label(thread.getProcessName())).growX().height(width/4).left().pad(20).row();

                t.table(Styles.none, ta -> {
                    TextButton killButton = new TextButton("Cancel");
                    killButton.clicked(() -> {
                        thread.shutdown();
                        build();
                    });
                    ta.add(killButton).height(width/4).width(width).left().pad(10);

                    Label label = new Label(thread.getPathToMedia());
                    label.setWrap(true);
                    ta.add(label).growX().height(width/4).left().pad(10).row();
                }).growX().row();

                t.table(Styles.none, ta -> {
                    Label progressLabel = new Label("");
                    labelMap.put(thread, progressLabel);
                    ta.add(progressLabel).width(width).height(width/4).left().pad(10);

                    Label frameProgressLabel = new Label("0/0");
                    frameProgressLabels.put(thread, frameProgressLabel);
                    ta.add(frameProgressLabel).width(width).height(width/4).right().pad(10)
                            .row();
                }).growX().center().row();

                if (thread.isFinished()) {
                    Label finishedLabel = new Label("Finished " + (thread.isErrored() ? " with errors" : ""));
                    t.add(finishedLabel).expand().height(50).bottom().right().pad(20).row();
                }
                frameProcessTables.put(thread, t);
            }).growX().left().pad(10);
            row();
        }
        if (doCreateDummy) {
            // create empty table for formatting because i am too lazy
            table(Styles.none, t -> {
                t.table().height(0).width(width).left().pad(10);
                t.table().growX().height(0).left().pad(10).row();
                t.table(Styles.none, ta -> {
                    ta.add(new Label("")).width(width).height(0).left().pad(10);
                    ta.add(new Label("")).width(width).height(0).right().pad(10).row();
                }).growX().center();
            }).growX().height(0).row();
        }
        row();
    }
}
