package processes;

import resources.ModVars;

public class ProcessThread extends Thread {
    protected volatile boolean shutdown = false;
    protected volatile String name;

    public ProcessThread(String name) {
        this.name = name;
    }

    public String getProcessName() {
        return name;
    }

    protected void method() {
        // implement
    }

    public void shutdown() {
        shutdown = true;
        ModVars.infoTag(this + " closed");
    }

    public boolean active() {
        return !shutdown;
    }



    public void run()
    {
        while (!shutdown) {
            try {
                method();
            } catch (Exception e) {
                System.out.println(e);
            }
        }
    }
}
