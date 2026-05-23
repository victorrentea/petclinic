package jdkdebug;

import com.sun.jdi.*;
import com.sun.jdi.connect.*;
import com.sun.jdi.event.*;
import com.sun.jdi.request.*;
import java.util.*;

public class Tracer {

    public static void main(String[] args) throws Exception {
        int port = Integer.parseInt(args[0]);
        int line = Integer.parseInt(args[1]);

        AttachingConnector connector = Bootstrap.virtualMachineManager().attachingConnectors().stream()
                .filter(c -> c.name().endsWith("SocketAttach")).findFirst().orElseThrow();
        Map<String, Connector.Argument> ca = connector.defaultArguments();
        ca.get("hostname").setValue("localhost");
        ca.get("port").setValue(String.valueOf(port));
        VirtualMachine vm = connector.attach(ca);

        EventRequestManager erm = vm.eventRequestManager();
        ClassPrepareRequest cpr = erm.createClassPrepareRequest();
        cpr.addClassFilter("jdkdebug.JdkInternalsTest");
        cpr.enable();

        loop:
        while (true) {
            EventSet set = vm.eventQueue().remove();
            for (Event ev : set) {
                if (ev instanceof ClassPrepareEvent cpe) {
                    // Break inside the LAMBDA body on the given line (skip the streamPipeline() caller location)
                    Location target = cpe.referenceType().locationsOfLine(line).stream()
                            .filter(l -> l.method().name().startsWith("lambda$"))
                            .findFirst()
                            .orElseThrow(() -> new IllegalStateException(
                                    "No lambda body on line " + line));
                    erm.createBreakpointRequest(target).enable();
                } else if (ev instanceof BreakpointEvent bpe) {
                    ThreadReference t = bpe.thread();
                    Location loc = bpe.location();
                    System.out.printf("%n=== Breakpoint hit: %s#%s (line %d) ===%n",
                            loc.declaringType().name(), loc.method().name(), loc.lineNumber());

                    System.out.println("\n--- Local variables ---");
                    StackFrame top = t.frame(0);
                    for (LocalVariable lv : top.visibleVariables()) {
                        System.out.printf("  %-20s %-6s = %s%n",
                                lv.typeName(), lv.name(), render(top.getValue(lv)));
                    }

                    System.out.println("\n--- Stack trace (innermost first) ---");
                    List<StackFrame> frames = t.frames();
                    for (int i = 0; i < frames.size(); i++) {
                        Location fl = frames.get(i).location();
                        System.out.printf("  [%2d] %s#%s (line %d)%n",
                                i, fl.declaringType().name(), fl.method().name(),
                                safeLine(fl));
                    }
                    set.resume();
                    break loop;
                }
            }
            set.resume();
        }
        vm.dispose();
    }

    private static String render(Value v) {
        if (v instanceof ObjectReference o && Integer.class.getName().equals(o.referenceType().name())) {
            return String.valueOf(o.getValue(o.referenceType().fieldByName("value")));
        }
        return String.valueOf(v);
    }

    private static int safeLine(Location l) {
        try { return l.lineNumber(); } catch (Exception e) { return -1; }
    }
}
