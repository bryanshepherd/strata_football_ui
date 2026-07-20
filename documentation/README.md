# Strata Football UI Documentation

**Comprehensive documentation for the football scoring application**

## Overview

This documentation provides complete coverage of the Strata Football UI, a React-based application for real-time football game scoring and statistics management. The system features keyboard-driven workflows, comprehensive play input flows, and real-time game state management.

## Quick Start

- **Development**: See [08-Build-Run-Test.md](08-Build-Run-Test.md)
- **Architecture**: See [01-Architecture.md](01-Architecture.md)  
- **Contributing**: See [09-Contributing-Guide.md](09-Contributing-Guide.md)

## Documentation Index

### Core Documentation

#### [00-Repo-Map.md](00-Repo-Map.md) - Repository Structure
- **Purpose**: Complete file tree and module dependency analysis
- **Contents**: 
  - Directory structure with file purposes
  - Top 30 modules by import/export frequency
  - Module dependency graph with Mermaid diagrams
  - Import patterns and architectural overview
- **Key Diagrams**: High-level module dependency graph
- **Use When**: Understanding codebase structure, onboarding new developers

#### [01-Architecture.md](01-Architecture.md) - Application Architecture  
- **Purpose**: High-level system design and technology stack
- **Contents**:
  - Three-layer architecture (Presentation, Business Logic, Data Access)
  - React Context state management patterns
  - Component hierarchy and data flow
  - Build and deployment architecture
- **Key Diagrams**: Component tree, data flow sequence diagram
- **Use When**: Understanding system design, making architectural decisions

#### [02-GameState-and-DataContracts.md](02-GameState-and-DataContracts.md) - Data Structures
- **Purpose**: Canonical data shapes and type definitions
- **Contents**:
  - TypeScript interfaces for all major data structures
  - Frontend ↔ Backend field mapping
  - Validation rules and default values
  - Example data with field documentation tables
- **Key References**: StandardGameState, PlayData interfaces
- **Use When**: Working with API integration, debugging data issues

### Technical Implementation

#### [03-APIs-and-Endpoints.md](03-APIs-and-Endpoints.md) - API Documentation
- **Purpose**: Complete API endpoint reference
- **Contents**:
  - All 15+ API endpoints with request/response examples
  - Error handling patterns and status codes
  - Network communication sequence diagrams
  - Call site references with file/line numbers
  - **Phase 2**: Multi-user game locking APIs
- **Key Sequence**: Full scoring cycle from UI to database
- **Use When**: Debugging API issues, backend integration

#### [04-State-Management.md](04-State-Management.md) - React State Management
- **Purpose**: Context providers, reducers, and custom hooks
- **Contents**:
  - Three main contexts (Game, Flow, Clock) with actions
  - Custom hook implementations and patterns
  - State invariants and optimization strategies
  - Optimistic updates vs server truth patterns
  - **Phase 2**: Multi-user safety, performance optimizations, drive rules integration
- **Key Patterns**: Context-based state management, custom hooks, lock status awareness
- **Use When**: Working with application state, debugging state issues

#### [05-Play-Input-and-Flows.md](05-Play-Input-and-Flows.md) - User Interaction Flows
- **Purpose**: Detailed play input workflow documentation
- **Contents**:
  - State machines for all 6 play types (rush, pass, punt, kick, penalty, game control)
  - Keyboard shortcut mappings and flow triggers
  - Step-by-step flow progression with validation rules
  - Penalty queuing and integration patterns
- **Key Diagrams**: State machine diagrams for each flow
- **Use When**: Understanding user workflows, debugging flow issues

### Component Reference

#### [06-Components-Catalog.md](06-Components-Catalog.md) - Component Documentation
- **Purpose**: Comprehensive component reference guide
- **Contents**:
  - 20+ components with props, responsibilities, and context usage
  - Display, input, modal, and utility component categories
  - Integration patterns and performance considerations
  - Component architecture and relationships
- **Key Tables**: Props documentation for all major components
- **Use When**: Using existing components, understanding component APIs

#### [07-Error-Handling-and-Edge-Cases.md](07-Error-Handling-and-Edge-Cases.md) - Error Management
- **Purpose**: Error handling patterns and recovery strategies
- **Contents**:
  - Multi-layer error handling (Network, Data, UI, Context)
  - Automatic recovery mechanisms and manual recovery options
  - Edge case handling for game state, user input, and API failures
  - Error logging and monitoring patterns
- **Key Patterns**: Try/catch wrappers, optimistic update rollback
- **Use When**: Implementing error handling, debugging production issues

### Development and Maintenance

#### [05-Testing-Strategy.md](05-Testing-Strategy.md) - Comprehensive Testing Framework
- **Purpose**: Testing architecture and Phase 2 validation
- **Contents**:
  - Vitest framework configuration and test categories
  - Multi-user safety tests (12 test cases)
  - Performance optimization tests (15 test cases) 
  - Integration tests for Phase 2 features (10 test cases)
  - Mock data generation and test helper functions
- **Key Metrics**: 103 passing tests, high coverage across Phase 2 features
- **Use When**: Writing tests, validating Phase 2 functionality

#### [08-Build-Run-Test.md](08-Build-Run-Test.md) - Development Setup
- **Purpose**: Complete development and build instructions
- **Contents**:
  - Installation and setup procedures
  - Development server configuration with Vite
  - Build process and production deployment
  - Environment variables and configuration options
  - **Phase 2**: Testing commands for new test suites
- **Key Commands**: `npm run dev`, `npm run build`, `npm test`, testing procedures
- **Use When**: Setting up development environment, deploying application

#### [09-Contributing-Guide.md](09-Contributing-Guide.md) - Development Guidelines
- **Purpose**: Coding standards and contribution workflows
- **Contents**:
  - Code style conventions and naming patterns
  - Git workflow with branch naming and commit message standards
  - Step-by-step guides for adding new features
  - Pull request process and review guidelines
- **Key Templates**: Component templates, flow templates, PR template
- **Use When**: Contributing code, maintaining consistency

### Reference Materials

#### [10-Glossary-and-Domain-Notes.md](10-Glossary-and-Domain-Notes.md) - Domain Knowledge
- **Purpose**: Football terminology and application-specific terms
- **Contents**:
  - Football rules and terminology (downs, field position, play types)
  - Application UI/UX terms and technical terminology
  - Data structure field definitions with examples
  - Position abbreviations and penalty classifications
- **Key Reference**: Yard line notation, result codes, statistics terms
- **Use When**: Understanding football context, learning application terminology

### Quality and Planning

#### [11-Code-Health-Audit.md](11-Code-Health-Audit.md) - Code Quality Assessment
- **Purpose**: Code health analysis and improvement recommendations
- **Contents**:
  - Dead code analysis and unused file identification
  - TODO/FIXME comment tracking with priority levels
  - Code duplication patterns and refactoring opportunities
  - Performance optimization recommendations
- **Overall Score**: B+ with specific improvement areas
- **Use When**: Planning refactoring, improving code quality

#### [12-Open-Questions.md](12-Open-Questions.md) - Unresolved Issues
- **Purpose**: Ambiguities requiring clarification or investigation
- **Contents**:
  - Data shape uncertainties and behavioral ambiguities
  - Technical implementation questions
  - User experience gaps and performance concerns
  - Suggested investigation priorities with resolution processes
- **Key Questions**: Multi-user support, drive calculation rules, offline capability
- **Use When**: Planning features, resolving ambiguities

## How to Use This Documentation

### For New Developers
**Recommended Reading Order**:
1. [00-Repo-Map.md](00-Repo-Map.md) - Understand file structure
2. [01-Architecture.md](01-Architecture.md) - Learn system design
3. [08-Build-Run-Test.md](08-Build-Run-Test.md) - Set up development environment
4. [09-Contributing-Guide.md](09-Contributing-Guide.md) - Learn development practices
5. [06-Components-Catalog.md](06-Components-Catalog.md) - Explore component APIs

### For Feature Development
**Essential References**:
- [05-Play-Input-and-Flows.md](05-Play-Input-and-Flows.md) - User interaction patterns
- [04-State-Management.md](04-State-Management.md) - State management patterns
- [03-APIs-and-Endpoints.md](03-APIs-and-Endpoints.md) - API integration
- [02-GameState-and-DataContracts.md](02-GameState-and-DataContracts.md) - Data structures

### For Debugging
**Primary Resources**:
- [07-Error-Handling-and-Edge-Cases.md](07-Error-Handling-and-Edge-Cases.md) - Error patterns
- [03-APIs-and-Endpoints.md](03-APIs-and-Endpoints.md) - API troubleshooting
- [12-Open-Questions.md](12-Open-Questions.md) - Known issues and ambiguities

### For System Maintenance
**Key Documents**:
- [11-Code-Health-Audit.md](11-Code-Health-Audit.md) - Technical debt assessment
- [08-Build-Run-Test.md](08-Build-Run-Test.md) - Deployment procedures
- [09-Contributing-Guide.md](09-Contributing-Guide.md) - Maintenance standards

## Key Features Covered

### Real-time Game Scoring
- Live score and game state management
- Play-by-play entry with keyboard shortcuts
- Automatic down/distance calculation
- Team and individual statistics tracking

### Advanced Play Input Workflows  
- 6 different play types with specialized flows
- Penalty integration and queuing system
- Player disambiguation and unknown player handling
- Validation and error recovery at each step

### Comprehensive State Management
- Three-layer React Context architecture
- Optimistic updates with server synchronization
- Automatic error recovery and health monitoring
- Data transformation between frontend and backend

### Phase 2 Multi-User Features ✅
- **Lock Status Awareness**: Real-time display of who is scoring
- **Submission Protection**: Prevent conflicts between concurrent users  
- **Performance Optimization**: Pagination for large games (>75 plays)
- **Drive Rules Integration**: Automatic drive transitions and possession changes

### Professional Development Practices
- TypeScript integration for type safety
- Comprehensive error handling patterns  
- Performance optimization strategies
- **Complete Test Coverage**: 103 tests across all Phase 2 features

## Architecture Highlights

### Technology Stack
- **Frontend**: React 18 with hooks, TailwindCSS, Vite build system
- **State Management**: React Context API with custom hooks
- **Data Layer**: TypeScript API contracts with transformation layer
- **Backend Integration**: RESTful APIs with comprehensive error handling

### Key Design Patterns
- **Context Provider Pattern**: Global state management
- **Custom Hook Pattern**: Shared logic extraction
- **Flow-based UI**: Step-by-step user workflows
- **Data Transformation**: Frontend/backend data mapping

### Performance Features
- **Component Memoization**: Optimized re-rendering with React.memo
- **Data Caching**: Intelligent roster and player data caching
- **Optimistic Updates**: Immediate UI feedback with server confirmation
- **Error Recovery**: Automatic retry and fallback mechanisms
- **Phase 2 Pagination**: Large game optimization (>75 plays paginated)

## Documentation Metrics

- **Total Files**: 14 documentation files (includes Phase 2 testing documentation)
- **Total Pages**: ~170 pages of comprehensive documentation  
- **Code References**: 200+ specific file/line references
- **Diagrams**: 15+ Mermaid diagrams (state machines, architecture, data flow)
- **API Endpoints**: 15+ documented endpoints with examples
- **Components**: 20+ documented components with props tables
- **Test Coverage**: 103 tests across multi-user safety, performance, and integration

## Generated Files Summary

| File | Size | Key Content |
|------|------|-------------|
| 00-Repo-Map.md | ~6 pages | File structure, dependency graph |
| 01-Architecture.md | ~8 pages | System design, component tree |
| 02-GameState-and-DataContracts.md | ~12 pages | Data structures, field mappings |
| 03-APIs-and-Endpoints.md | ~10 pages | API reference, sequence diagrams |
| 04-State-Management.md | ~15 pages | Context providers, Phase 2 enhancements |
| 05-Play-Input-and-Flows.md | ~12 pages | State machines, user workflows |
| **05-Testing-Strategy.md** | **~8 pages** | **Phase 2 test framework, 103 tests** |
| 06-Components-Catalog.md | ~14 pages | Component props, responsibilities |
| 07-Error-Handling-and-Edge-Cases.md | ~10 pages | Error patterns, recovery strategies |
| 08-Build-Run-Test.md | ~8 pages | Development setup, build process |
| 09-Contributing-Guide.md | ~12 pages | Code standards, development workflow |
| 10-Glossary-and-Domain-Notes.md | ~8 pages | Football terms, application vocabulary |
| 11-Code-Health-Audit.md | ~10 pages | Code quality analysis, recommendations |
| 12-Open-Questions.md | ~8 pages | Unresolved issues, investigation needs |

## Updates and Maintenance

This documentation was generated through comprehensive codebase analysis on August 26, 2025. 

**Phase 2 Completed (August 2025)**:
- ✅ Multi-user safety with lock status awareness
- ✅ Performance optimizations for large games
- ✅ Drive rules integration
- ✅ Comprehensive test coverage (103 tests)
- ✅ Complete documentation updates

**Maintenance Recommendations**:
- Update documentation when major features are added
- Run test suites regularly: `npm test`
- Revisit [12-Open-Questions.md](12-Open-Questions.md) quarterly to resolve ambiguities
- Update [11-Code-Health-Audit.md](11-Code-Health-Audit.md) after significant refactoring
- Keep [03-APIs-and-Endpoints.md](03-APIs-and-Endpoints.md) current with API changes
- Monitor Phase 2 performance metrics in production

For questions about this documentation or suggestions for improvements, please refer to the contributing guidelines in [09-Contributing-Guide.md](09-Contributing-Guide.md).