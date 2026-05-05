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