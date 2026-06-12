terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.21"
    }
  }
}
provider "azurerm" {
  features {}
  storage_use_azuread = true
}

terraform {
  backend "azurerm" {
    resource_group_name  = "notewise-pipeline" #change here
    storage_account_name = "tfstatefilesecret001" #change here
    container_name       = "tfstate"
    key                  = "terraform.tfstate"
  }
}

resource "azurerm_resource_group" "notewise" {
  name     = "notewise" #change here
  location = "polandcentral"
}

resource "azurerm_storage_account" "notewise-sg" {
    name                = "notewise001"
    resource_group_name = azurerm_resource_group.notewise.name
    location            = azurerm_resource_group.notewise.location
    account_tier        = "Standard"
    account_replication_type = "LRS"
}

resource "azurerm_storage_container" "notewise-sg-container" {
  name                  = "notewise-dev"
  storage_account_id = azurerm_storage_account.notewise-sg.id
  container_access_type = "private"
}

data "azurerm_storage_account" "tfstate" {
  name                = "tfstatefilesecret001"
  resource_group_name = "notewise-pipeline"
}

resource "azurerm_private_dns_zone" "blob" {
  name                = "privatelink.blob.core.windows.net"
  resource_group_name = azurerm_resource_group.notewise.name
}

resource "azurerm_private_dns_zone_virtual_network_link" "blob" {
  name                  = "link-notewise-vnet"
  resource_group_name   = azurerm_resource_group.notewise.name
  private_dns_zone_name = azurerm_private_dns_zone.blob.name
  virtual_network_id    = azurerm_virtual_network.notewise_vnet.id
}

resource "azurerm_private_endpoint" "tfstate" {
  name                = "pe-tfstate-blob"
  resource_group_name = azurerm_resource_group.notewise.name
  location            = azurerm_resource_group.notewise.location
  subnet_id           = azurerm_subnet.storage.id   # fine to reuse; a dedicated subnet is optional

  private_service_connection {
    name                           = "psc-tfstate-blob"
    private_connection_resource_id = data.azurerm_storage_account.tfstate.id
    subresource_names              = ["blob"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "dns-blob"
    private_dns_zone_ids = [azurerm_private_dns_zone.blob.id]
  }
}

resource "azurerm_postgresql_flexible_server" "notewise_server" {
  name                = "notewise-server001"
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
    address_space     = ["10.1.0.0/16"]
}

resource "azurerm_subnet" "integration" {
    name = "integration_subnet"
    resource_group_name = azurerm_resource_group.notewise.name
    virtual_network_name = azurerm_virtual_network.notewise_vnet.name
    address_prefixes = ["10.1.10.0/24"]
}

resource "azurerm_subnet" "aks" {
    name = "aks_subnet"
    resource_group_name = azurerm_resource_group.notewise.name
    virtual_network_name = azurerm_virtual_network.notewise_vnet.name
    address_prefixes = ["10.1.20.0/24"]
}

resource "azurerm_subnet" "storage" {
    name = "storage_subnet"
    resource_group_name = azurerm_resource_group.notewise.name
    virtual_network_name = azurerm_virtual_network.notewise_vnet.name
    address_prefixes = ["10.1.30.0/24"]
}

resource "azurerm_resource_group" "notewise-functionapp" {
  name     = "notewise-functionapp"
  location = "northeurope"
}

resource "azurerm_storage_account" "notewise-functionapp" {
    name                = "notewisefunctionapp001"
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
  sku_name            = "FC1"
  os_type             = "Linux"
}

resource "azurerm_role_assignment" "func_storage" {
  scope = azurerm_storage_account.notewise-functionapp.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id = azurerm_function_app_flex_consumption.notewise.identity[0].principal_id
  
}

resource "azurerm_role_assignment" "func_uploads_storage" {
  scope                = azurerm_storage_account.notewise-sg.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_function_app_flex_consumption.notewise.identity[0].principal_id
}

resource "azurerm_function_app_flex_consumption" "notewise" {
  name                = "notewise001"
  resource_group_name = azurerm_resource_group.notewise-functionapp.name
  location            = azurerm_resource_group.notewise-functionapp.location
  service_plan_id     = azurerm_service_plan.notewise-functionapp-plan.id

  storage_container_type = "blobContainer"
  storage_container_endpoint = "${azurerm_storage_account.notewise-functionapp.primary_blob_endpoint}${azurerm_storage_container.notewise-functionapp-container.name}"
  storage_authentication_type = "SystemAssignedIdentity"
  # storage_access_key  = azurerm_storage_account.notewise-functionapp.primary_access_key

  identity { type = "SystemAssigned" }

  runtime_name    = "python"
  runtime_version = "3.13"

  site_config {}

  app_settings = {
    "AzureWebJobsDisableHomepage"    = "true"
    "APPINSIGHTS_INSTRUMENTATIONKEY" = azurerm_application_insights.notewise-functionapp-ai.instrumentation_key
    "DATABASE_URL" = "postgresql+psycopg2://notewise:Password1234@notewise-server.postgres.database.azure.com:5432/notewise-db?sslmode=require"
  }
}


resource "azurerm_virtual_network" "function-vnet" {
  name = "function-vnet"
  resource_group_name = azurerm_function_app_flex_consumption.notewise.resource_group_name
  location = azurerm_function_app_flex_consumption.notewise.location
  address_space = ["10.2.0.0/16"]
}

resource "azurerm_subnet" "func_subnet" {
    name = "func_sub"
    resource_group_name = azurerm_function_app_flex_consumption.notewise.resource_group_name
    virtual_network_name = azurerm_virtual_network.function-vnet.name
    address_prefixes = ["10.2.10.0/24"]
}

resource "azurerm_linux_virtual_machine" "runner" {
  name                = "gh-runner-01"
  resource_group_name = azurerm_resource_group.notewise.name
  location            = azurerm_resource_group.notewise.location
  size                = "Standard_B2s"
  admin_username      = "azureuser"
  admin_password   = "Password1234"

  disable_password_authentication = false

  network_interface_ids = [azurerm_network_interface.runner.id]  

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
    disk_size_gb         = 64
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "ubuntu-24_04-lts"
    sku       = "server"
    version   = "latest"
  }
}

resource "azurerm_network_interface" "runner" {
  name                = "runner-vm-nic"
  resource_group_name = azurerm_resource_group.notewise.name
  location            = azurerm_resource_group.notewise.location

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.storage.id
    private_ip_address_allocation = "Dynamic"
  }
}