use openhuman_core::core::events::DomainEvent;
use openhuman_core::openhuman::tavis::knowledge_graph::{
    project_memory_event, GraphEdge, GraphNode,
};

#[test]
fn memory_stored_projects_to_derived_graph_without_owning_memory() {
    let event = DomainEvent::MemoryStored {
        key: "alice".into(),
        category: "person".into(),
        namespace: "contacts".into(),
    };

    let projection = project_memory_event(&event).expect("memory event must project");
    assert_eq!(
        projection.node,
        GraphNode {
            id: "memory:contacts:alice".into(),
            kind: "person".into(),
            source: "openhuman.memory".into(),
        }
    );
    assert_eq!(
        projection.edge,
        GraphEdge {
            from: "namespace:contacts".into(),
            to: "memory:contacts:alice".into(),
            relation: "contains".into(),
        }
    );
}

#[test]
fn non_memory_events_do_not_create_graph_state() {
    let event = DomainEvent::AgentTurnCompleted {
        session_id: "s".into(),
        text_chars: 1,
        iterations: 1,
    };
    assert!(project_memory_event(&event).is_none());
}
