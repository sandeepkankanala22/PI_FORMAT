"""Typed exceptions for product information extraction."""


class ProductInfoExtractError(Exception):
    """Base exception for extraction pipeline errors."""

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class UnsupportedFileType(ProductInfoExtractError):
    pass


class EmptyDocument(ProductInfoExtractError):
    pass


class CorruptDocument(ProductInfoExtractError):
    pass


class UrlFetchError(ProductInfoExtractError):
    pass


class BedrockTimeout(ProductInfoExtractError):
    pass


class InvalidJson(ProductInfoExtractError):
    pass


class FileTooLarge(ProductInfoExtractError):
    pass
