//! Derived TAVIS knowledge-graph projection over OpenHuman memory events.
//!
//! OpenHuman/tinymemory remains canonical storage. This module emits graph
//! projection records only; it deliberately owns no memory database.

use crate::core::events::DomainEvent;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GraphNode {
    pub id: String,
    pub kind: String,
    pub source: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GraphEdge {
    pub from: String,
    pub to: String,
    pub relation: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GraphProjection {
    pub node: GraphNode,
    pub edge: GraphEdge,
}

fn project_document(namespace: &str, document_id: &str, relation: &str) -> GraphProjection {
    let node_id = format!("document:{namespace}:{document_id}");
    GraphProjection {
        node: GraphNode {
            id: node_id.clone(),
            kind: "document".into(),
            source: "openhuman.memory.ingestion".into(),
        },
        edge: GraphEdge {
            from: format!("namespace:{namespace}"),
            to: node_id,
            relation: relation.into(),
        },
    }
}

pub fn project_memory_event(event: &DomainEvent) -> Option<GraphProjection> {
    match event {
        DomainEvent::MemoryStored {
            key,
            category,
            namespace,
        } => {
            let node_id = format!("memory:{namespace}:{key}");
            Some(GraphProjection {
                node: GraphNode {
                    id: node_id.clone(),
                    kind: category.clone(),
                    source: "openhuman.memory".into(),
                },
                edge: GraphEdge {
                    from: format!("namespace:{namespace}"),
                    to: node_id,
                    relation: "contains".into(),
                },
            })
        }
        DomainEvent::MemoryIngestionStarted {
            document_id,
            namespace,
            ..
        } => Some(project_document(namespace, document_id, "ingests")),
        DomainEvent::MemoryIngestionCompleted {
            document_id,
            namespace,
            success,
            ..
        } if *success => Some(project_document(namespace, document_id, "ingested")),
        _ => None,
    }
}
