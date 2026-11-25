// Struct
pub mod structs;

// Functions
#[path = "functions/game.rs"]
mod game_functions;

#[path = "functions/game_engine.rs"]
mod game_engine_functions;

#[path = "functions/loader.rs"]
mod loader_functions;

// Commands
#[path = "commands/game.rs"]
pub mod game;

#[path = "commands/game_engine.rs"]
pub mod game_engine;

#[path = "commands/loader.rs"]
pub mod loader;