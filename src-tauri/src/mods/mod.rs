// Struct
pub mod structs;

// Functions
#[path = "functions/anticensor.rs"]
mod anticensor_functions;

#[path = "functions/folder_icon.rs"]
mod folder_icon_functions;

#[path = "functions/import.rs"]
mod import_functions;

#[path = "functions/manage.rs"]
mod manage_functions;

#[path = "functions/ui_mods.rs"]
mod ui_mods_functions;

// Commands
#[path = "commands/anticensor.rs"]
pub mod anticensor;

#[path = "commands/folder_icon.rs"]
pub mod folder_icon;

#[path = "commands/import.rs"]
pub mod import;

#[path = "commands/manage.rs"]
pub mod manage;

#[path = "commands/ui_mods.rs"]
pub mod ui_mods;