// Struct
pub mod structs;

// Functions
#[path = "functions/dialog.rs"]
pub mod dialog_functions;

#[path = "functions/elevated.rs"]
pub mod elevated_functions;

#[path = "functions/utils.rs"]
pub mod utils_functions;

// Commands
#[path = "commands/dialog.rs"]
pub mod dialog;

#[path = "commands/elevated.rs"]
pub mod elevated;

#[path = "commands/utils.rs"]
pub mod utils;