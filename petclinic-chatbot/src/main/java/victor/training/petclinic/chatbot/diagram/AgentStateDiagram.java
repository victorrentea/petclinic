package victor.training.petclinic.chatbot.diagram;

import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.lang.reflect.Parameter;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

import com.embabel.agent.api.annotation.AchievesGoal;
import com.embabel.agent.api.annotation.Action;

/**
 * DETERMINISTIC, OFFLINE generator that renders a PlantUML state diagram for an Embabel {@code @Agent}.
 *
 * <p>An Embabel {@code @Agent} is a GOAP graph: each {@link Action} method declares its input
 * blackboard types (its parameters) and produces an output (its return type). The goal action also
 * carries {@link AchievesGoal}. We render a STATE diagram where blackboard types are STATES and
 * {@code @Action} methods are TRANSITIONS ({@code State --> ReturnState : methodName}).
 *
 * <p>This uses PLAIN REFLECTION only — no running {@code AgentPlatform}, no Spring context, no LLM,
 * no network. Embabel ships an {@code AgentMetadataReader} that can build a richer metadata model,
 * but it requires instantiating the agent (whose constructors need a model String / guard supplier)
 * and leans on Kotlin value-class {@code IoBinding} internals and validators. Reflection over the
 * {@code @Action} method signatures is simpler, fully offline, and deterministic — so we use it.
 *
 * <h2>State derivation</h2>
 * <ul>
 *   <li>{@code produced} = the set of all {@code @Action} return types.</li>
 *   <li>{@code entryTypes} = parameter types that are nested record/domain types <em>of the agent</em>
 *       but are never produced (e.g. {@code OwnerSymptom}, {@code Incident}).</li>
 *   <li>A parameter is a STATE iff its type is in {@code (produced ∪ entryTypes)}. Every other
 *       parameter (e.g. {@code OperationContext}, {@code HealthProbe}, {@code GrafanaClient}) is an
 *       injected service and is IGNORED.</li>
 * </ul>
 *
 * Output is wrapped in {@code @startuml ... @enduml} with stable (sorted) ordering so the result is
 * byte-for-byte deterministic.
 */
public final class AgentStateDiagram {

  private AgentStateDiagram() {
  }

  /** Render the PlantUML state diagram for the given {@code @Agent} class. */
  public static String render(Class<?> agentClass) {
    List<Method> actions = actionMethods(agentClass);

    Set<Class<?>> produced = new LinkedHashSet<>();
    for (Method m : actions) {
      produced.add(m.getReturnType());
    }

    // Entry types: nested types of the agent used as @Action params but never produced.
    Set<Class<?>> entryTypes = new LinkedHashSet<>();
    for (Method m : actions) {
      for (Parameter p : m.getParameters()) {
        Class<?> type = p.getType();
        if (!produced.contains(type) && isNestedDomainType(agentClass, type)) {
          entryTypes.add(type);
        }
      }
    }

    Set<Class<?>> states = new LinkedHashSet<>();
    states.addAll(produced);
    states.addAll(entryTypes);

    // Stable, sorted state declarations.
    Set<String> stateNames = new TreeSet<>();
    for (Class<?> s : states) {
      stateNames.add(s.getSimpleName());
    }

    // Transitions, with the start/goal markers, all sorted for determinism.
    Set<String> transitions = new TreeSet<>();
    for (Class<?> entry : entryTypes) {
      transitions.add("[*] --> " + entry.getSimpleName());
    }
    for (Method m : actions) {
      Class<?> returnType = m.getReturnType();
      if (!states.contains(returnType)) {
        continue; // defensive: a goal that produces a non-state type (not expected here)
      }
      String returnName = returnType.getSimpleName();
      for (Parameter p : m.getParameters()) {
        Class<?> type = p.getType();
        if (states.contains(type)) {
          transitions.add(type.getSimpleName() + " --> " + returnName + " : " + m.getName());
        }
      }
      if (m.isAnnotationPresent(AchievesGoal.class)) {
        transitions.add(returnName + " --> [*]");
      }
    }

    StringBuilder sb = new StringBuilder();
    sb.append("@startuml\n");
    sb.append("' Generated from ").append(agentClass.getName()).append('\n');
    sb.append("' DETERMINISTIC, OFFLINE: derived by reflection over @Action method signatures.\n");
    sb.append("title ").append(agentClass.getSimpleName()).append('\n');
    for (String state : stateNames) {
      sb.append("state ").append(state).append('\n');
    }
    for (String transition : transitions) {
      sb.append(transition).append('\n');
    }
    sb.append("@enduml\n");
    return sb.toString();
  }

  private static List<Method> actionMethods(Class<?> agentClass) {
    List<Method> actions = new ArrayList<>();
    for (Method m : agentClass.getDeclaredMethods()) {
      if (m.isAnnotationPresent(Action.class)) {
        actions.add(m);
      }
    }
    return actions;
  }

  /** A type is a blackboard/domain type if it is a nested type declared inside the agent class. */
  private static boolean isNestedDomainType(Class<?> agentClass, Class<?> type) {
    Class<?> enclosing = type.getEnclosingClass();
    return enclosing != null && enclosing.equals(agentClass) && Modifier.isStatic(type.getModifiers());
  }
}
