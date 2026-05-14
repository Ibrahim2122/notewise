terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.14"
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
  location = "polandcentral"
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
  storage_account_id = azurerm_storage_account.notewise.id
  container_access_type = "private"
}

resource "azurerm_postgresql_flexible_server" "notewise_server" {
  name                = "notewise-server"
  location            = azurerm_resource_group.notewise.location
  resource_group_name = azurerm_resource_group.notewise.name
  version             = "16"
  administrator_login          = "notewise"
  administrator_password = "Password1234"
  sku_name   = "B_Standard_B1ms"
  storage_mb = 32768
  backup_retention_days        = 7
  geo_redundant_backup_enabled = false
  zone = "1"
}

resource "azurerm_postgresql_flexible_server_database" "notewise_db" {
  name                = "notewise-db"
  server_id           = azurerm_postgresql_flexible_server.notewise_server.id
  charset             = "UTF8"
  collation           = "en_US.utf8"
}

resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_azure_services" {
  name                = "allow-app"
  server_id           = azurerm_postgresql_flexible_server.notewise_server.id
  start_ip_address    = "0.0.0.0"
  end_ip_address      = "255.255.255.255"
}

resource "azurerm_virtual_network" "notewise_vnet" {
    name               = "notewise-vnet"
    resource_group_name = azurerm_resource_group.notewise.name
    location           = azurerm_resource_group.notewise.location
    address_space     = ["192.168.0.0/16"]
}

resource "azurerm_subnet" "integration" {
    name = "integration_subnet"
    resource_group_name = azurerm_resource_group.notewise.name
    virtual_network_name = azurerm_virtual_network.notewise_vnet.name
    address_prefixes = ["192.168.10.0/24"]
}

resource "azurerm_subnet" "aks" {
    name = "aks_subnet"
    resource_group_name = azurerm_resource_group.notewise.name
    virtual_network_name = azurerm_virtual_network.notewise_vnet.name
    address_prefixes = ["192.168.20.0/24"]
}

resource "azurerm_subnet" "storage" {
    name = "storage_subnet"
    resource_group_name = azurerm_resource_group.notewise.name
    virtual_network_name = azurerm_virtual_network.notewise_vnet.name
    address_prefixes = ["192.168.30.0/24"]
}

resource "azurerm_resource_group" "notewise-functionapp" {
  name     = "notewise-functionapp"
  location = "polandcentral"
}

resource "azurerm_storage_account" "notewise-functionapp" {
    name                = "notewisefunctionapp"
    resource_group_name = azurerm_resource_group.notewise-functionapp.name
    location            = azurerm_resource_group.notewise-functionapp.location
    account_tier        = "Standard"
    account_replication_type = "LRS"
}

resource "azurerm_storage_container" "notewise-functionapp-container" {
  name                  = "notewise-functionapp"
  storage_account_id = azurerm_storage_account.notewise-functionapp.id
  container_access_type = "private"
}

resource "azurerm_log_analytics_workspace" "notewise-functionapp-law" {
  name                = "notewise-functionapp-law"
  location            = azurerm_resource_group.notewise-functionapp.location
  resource_group_name = azurerm_resource_group.notewise-functionapp.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

resource "azurerm_application_insights" "notewise-functionapp-ai" {
  name                = "notewise-functionapp-ai"
  location            = azurerm_resource_group.notewise-functionapp.location
  resource_group_name = azurerm_resource_group.notewise-functionapp.name
  application_type     = "web"
  workspace_id        = azurerm_log_analytics_workspace.notewise-functionapp-law.id
}

resource "azurerm_service_plan" "notewise-functionapp-plan" {
  name                = "notewise-functionapp-plan"
  resource_group_name = azurerm_resource_group.notewise-functionapp.name
  location            = azurerm_resource_group.notewise-functionapp.location
  sku_name            = "Y1"
  os_type             = "Windows"
}

resource "azurerm_linux_function_app" "notewise-functionapp" {
  name                = "notewise-functionapp"
  resource_group_name = azurerm_resource_group.notewise-functionapp.name
  location            = azurerm_resource_group.notewise-functionapp.location
  service_plan_id     = azurerm_service_plan.notewise-functionapp-plan.id

  storage_account_name       = azurerm_storage_account.notewise-functionapp.name
  storage_account_access_key = azurerm_storage_account.notewise-functionapp.primary_access_key

  site_config {
    application_stack {
      python_version = "3.11"
    }
  }

  app_settings = {
    APPLICATIONINSIGHTS_CONNECTION_STRING = azurerm_application_insights.notewise-functionapp-ai.connection_string
  }
}
