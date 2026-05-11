terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "=4.1.0"
    }
  }
}
provider "azurerm" {
  features {}
}

terraform {
  backend "azurerm" {
    resource_group_name  = "terraform-rg" #change here
    storage_account_name = "tfstatefilesecret" #change here
    container_name       = "tfstate"
    key                  = "terraform.tfstate"
  }
}

resource "azurerm_resource_group" "notewise" {
  name     = "notewise" #change here
  location = "eastus"
}

resource "azurerm_storage_account" "notewise" {
    name                = "notewise"
    resource_group_name = azurerm_resource_group.notewise.name
    location            = azurerm_resource_group.notewise.location
    account_tier        = "Standard"
    account_replication_type = "LRS"
}

resource "azurerm_storage_container" "notewise" {
  name                  = "notewise-dev"
  storage_account_name  = azurerm_storage_account.notewise.name
  container_access_type = "private"
}

resource "azurerm_postgresql_server" "notewise_db" {
  name                = "notewise-db"
  location            = azurerm_resource_group.notewise.location
  resource_group_name = azurerm_resource_group.notewise.name
  version             = "18"
  administrator_login          = "notewise"
  administrator_login_password = "Password1234"
  ssl_enforcement_enabled       = true
  sku_name   = "B_Standard_B1ms"
  storage_mb = 32768
  backup_retention_days        = 7
  geo_redundant_backup_enabled = false
}

resource "azurerm_postgresql_database" "notewise_db" {
  name                = "notewise-db"
  resource_group_name = azurerm_resource_group.notewise.name
  server_name         = azurerm_postgresql_server.notewise_db.name
  charset             = "UTF8"
  collation           = "English_United States.1252"
}

resource "azurerm_postgresql_firewall_rule" "allow_azure_services" {
  name                = "allow-app"
  resource_group_name = azurerm_resource_group.notewise.name
  server_name         = azurerm_postgresql_server.notewise_db.name
  start_ip_address    = "0.0.0.0"
  end_ip_address      = "255.255.255.255"
}

