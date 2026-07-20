<?php

namespace Strata\Football\Api\Support\Schema;

interface SchemaValidatorInterface
{
    /**
     * @throws SchemaValidationException when validation fails
     */
    public function validate(array $payload, ?string $resourceId = null): void;
}
