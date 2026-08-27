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

pub fn project_memory_event(event: &DomainEvent) -> Option<GraphProjection> {
    let DomainEvent::MemoryStored {
        key,
        category,
        namespace,
    } = event
    else {
        return None;
    };

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
