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