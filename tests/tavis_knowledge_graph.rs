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
fn memory_ingestion_started_projects_document_into_namespace() {
    let event = DomainEvent::MemoryIngestionStarted {
        document_id: "doc-42".into(),
        title: "Architecture Notes".into(),
        namespace: "projects".into(),
        queue_depth: 2,
    };

    let projection = project_memory_event(&event).expect("ingestion event must project");
    assert_eq!(
        projection.node,
        GraphNode {
            id: "document:projects:doc-42".into(),
            kind: "document".into(),
            source: "openhuman.memory.ingestion".into(),
        }
    );
    assert_eq!(
        projection.edge,
        GraphEdge {
            from: "namespace:projects".into(),
            to: "document:projects:doc-42".into(),
            relation: "ingests".into(),
        }
    );
}

#[test]
fn completed_ingestion_projects_same_document_identity() {
    let event = DomainEvent::MemoryIngestionCompleted {
        document_id: "doc-42".into(),
        namespace: "projects".into(),
        success: true,
        elapsed_ms: 17,
        queue_depth: 0,
    };

    let projection = project_memory_event(&event).expect("completed ingestion must project");
    assert_eq!(projection.node.id, "document:projects:doc-42");
    assert_eq!(projection.node.kind, "document");
    assert_eq!(projection.node.source, "openhuman.memory.ingestion");
    assert_eq!(projection.edge.relation, "ingested");
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
