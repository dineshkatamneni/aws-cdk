import { Construct } from 'constructs';
import { Billing } from './billing';
import { Capacity } from './capacity';
import { CfnGlobalTable } from './dynamodb.generated';
import { TableEncryptionV2 } from './encryption';
import { GlobalTableBase, IGlobalTable } from './global-table-base';
import {
  Attribute, TableClass, LocalSecondaryIndexProps,
  SecondaryIndexProps, BillingMode, ProjectionType,
} from './shared';
import { IStream } from '../../aws-kinesis';
import { IKey, Key } from '../../aws-kms';
import { ArnFormat, Lazy, PhysicalName, RemovalPolicy, Stack, Token } from '../../core';

const HASH_KEY_TYPE = 'HASH';
const RANGE_KEY_TYPE = 'RANGE';
const NEW_AND_OLD_IMAGES = 'NEW_AND_OLD_IMAGES';
const MAX_GSI_COUNT = 20;
const MAX_LSI_COUNT = 5;
const MAX_NON_KEY_ATTRIBUTES = 100;

/**
 * Options used to configure global secondary indexes on a Replica Table.
 */
export interface ReplicaGlobalSecondaryIndexOptions {
  /**
   * Whether CloudWatch contributor insights is enabled for a specific global secondary
   * index on a Replica Table.
   *
   * @default - inherited from Global Table
   */
  readonly contributorInsights?: boolean;

  /**
   * The read capacity for a specific global secondary index on a Replica Table.
   *
   * Note: This can only be configured if Global Table billing is provisioned.
   *
   * @default - inherited from Global Table
   */
  readonly readCapacity?: Capacity;
}

export interface GlobalSecondaryIndexPropsV2 extends SecondaryIndexProps {
  /**
   * Partition key attribute definition.
   */
  readonly partitionKey: Attribute;

  /**
   * Sort key attribute definition.
   *
   * @default - no sort key
   */
  readonly sortKey?: Attribute;

  /**
   * The read capacity.
   *
   * Note: This can only be configured if the Global Table billing is provisioned.
   *
   * @default - inherited from Global Table.
   */
  readonly readCapacity?: Capacity;

  /**
   * The write capacity.
   *
   * Note: This can only be configured if the Global Table billing is provisioned.
   *
   * @default - inherited from Global Table.
   */
  readonly writeCapacity?: Capacity;
}

/**
 * Common table options used to configure Global Tables and Replica Tables.
 */
export interface TableOptionsV2 {
  /**
   * Whether CloudWatch contributor insights is enabled.
   *
   * @default false
   */
  readonly contributorInsights?: boolean;

  /**
   * Whether deletion protection is enabled.
   *
   * @default false
   */
  readonly deletionProtection?: boolean;

  /**
   * Whether point-in-time reocvery is enabled.
   *
   * @default false
   */
  readonly pointInTimeRecovery?: boolean;

  /**
   * The table class.
   *
   * @default TableClass.STANDARD
   */
  readonly tableClass?: TableClass;

  /**
   * Kinesis Data Stream to capture item level changes.
   *
   * @default - no Kinesis Data Stream
   */
  readonly kinesisStream?: IStream;
}

/**
 * Properties used to configure a Replica Table.
 */
export interface ReplicaTableProps extends TableOptionsV2 {
  /**
   * The region that the Replica Table will be created in.
   */
  readonly region: string;

  /**
   * The read capacity.
   *
   * Note: This can only be configured if the Global Table billing is provisioned.
   *
   * @default - inherited from Global Table
   */
  readonly readCapacity?: Capacity;

  /**
   * Options used to configure global secondary index properties.
   *
   * @default - inherited from Global Table
   */
  readonly globalSecondaryIndexOptions?: { [indexName: string]: ReplicaGlobalSecondaryIndexOptions };
}

/**
 * Properties used to configure a Global Table.
 */
export interface GlobalTableProps extends TableOptionsV2 {
  /**
   * Partition key attribute definition.
   */
  readonly partitionKey: Attribute;

  /**
   * Sort key attribute definition.
   *
   * @default - no sort key
   */
  readonly sortKey?: Attribute;

  /**
   * The name of all Replica Tables in the Global Table.
   *
   * @default - generated by CloudFormation
   */
  readonly tableName?: string;

  /**
   * The name of the TTL attribute.
   *
   * @default - TTL is disabled
   */
  readonly timeToLiveAttribute?: string;

  /**
   * The removal policy applied to all Replica Tables in the Global Table.
   *
   * @default RemovalPolicy.RETAIN
   */
  readonly removalPolicy?: RemovalPolicy;

  /**
   * The billing mode and capacity settings.
   *
   * @default Billing.onDemand()
   */
  readonly billing?: Billing;

  /**
   * Replica Tables that are part of the Global Table.
   *
   * Note: You cannot specify a Replica Table in the region that the Global Table will be
   * deployed to. By default, a Global Table will have one Replica Table in the region that
   * it is deployed to. Replica Tables will only be supported if the stack deployment region
   * is defined.
   *
   * @default - a single Replica Table in the region the Global Table is deployed to
   */
  readonly replicas?: ReplicaTableProps[];

  /**
   * Global secondary indexes.
   *
   * Note: You can provide a maximum of 20 global secondary indexes.
   *
   * @default - no global secondary indexes
   */
  readonly globalSecondaryIndexes?: GlobalSecondaryIndexPropsV2[];

  /**
   * Local secondary indexes.
   *
   * Note: You can only provide a maximum of 5 local secondary indexes.
   *
   * @default - no local secondary indexes
   */
  readonly localSecondaryIndexes?: LocalSecondaryIndexProps[];

  /**
   * The server-side encryption.
   *
   * @default TableEncryptionV2.dynamoOwnedKey()
   */
  readonly encryption?: TableEncryptionV2;
}

/**
 * Attributes of a Global Table.
 */
export interface GlobalTableAttributes {
  /**
   * The ARN of the Global Table.
   *
   * Note: You must specify this or the `tableName`.
   *
   * @default - table arn generated using `tableName` and region of stack
   */
  readonly tableArn?: string;

  /**
   * The name of the Global Table.
   *
   * Note: You must specify this or the `tableArn`.
   *
   * @default - table name retrieved from provided `tableArn`
   */
  readonly tableName?: string;

  /**
   * The ID of the Global Table.
   *
   * @default - no table id
   */
  readonly tableId?: string;

  /**
   * The stream ARN of the Global Table.
   *
   * @default - no table stream ARN
   */
  readonly tableStreamArn?: string

  /**
   * KMS encryption key for the Global Table.
   *
   * @default - no KMS encryption key
   */
  readonly encryptionKey?: IKey;

  /**
   * The name of the global indexes set for the Global Table.
   *
   * Note: You must set either this property or `localIndexes` if you want permissions
   * to be granted for indexes as well as the Global Table itself.
   *
   * @default - no global indexes
   */
  readonly globalIndexes?: string[];

  /**
   * The name of the local indexes set for the Global Table.
   *
   * Note: You must set either this property or `globalIndexes` if you want permissions
   * to be granted for indexes as well as the Global Table itself.
   *
   * @default - no local indexes
   */
  readonly localIndexes?: string[]

  /**
   * Whether or not to grant permissions for all indexes of the Global Table.
   *
   * Note: If false, permissions will only be granted to indexes when `globalIndexes`
   * or `localIndexes` is specified.
   *
   * @default false
   */
  readonly grantIndexPermissions?: boolean;
}

/**
 * A Global Table.
 */
export class GlobalTable extends GlobalTableBase {
  /**
   * Creates a Global Table construct that represents an external Global Table via table name.
   *
   * @param scope the parent creating construct (usually `this`)
   * @param id the construct's name
   * @param tableName the Global Table's name
   */
  public static fromTableName(scope: Construct, id: string, tableName: string): IGlobalTable {
    return GlobalTable.fromTableAttributes(scope, id, { tableName });
  }

  /**
   * Creates a Global Table construct that represents an external Global Table via table ARN.
   *
   * @param scope the parent creating construct (usually `this`)
   * @param id the construct's name
   * @param tableArn the Global Table's ARN
   */
  public static fromTableArn(scope: Construct, id: string, tableArn: string): IGlobalTable {
    return GlobalTable.fromTableAttributes(scope, id, { tableArn });
  }

  /**
   * Creates a Global Table that represents an external Global Table.
   *
   * @param scope the parent creating construct (usually `this`)
   * @param id the construct's name
   * @param attrs attributes of the Global Table
   */
  public static fromTableAttributes(scope: Construct, id: string, attrs: GlobalTableAttributes): IGlobalTable {
    class Import extends GlobalTableBase {
      public readonly tableArn: string;
      public readonly tableName: string;
      public readonly tableId?: string;
      public readonly tableStreamArn?: string;
      public readonly encryptionKey?: IKey;

      protected readonly region: string;
      protected readonly hasIndex = (attrs.grantIndexPermissions ?? false) ||
        (attrs.globalIndexes ?? []).length > 0 ||
        (attrs.localIndexes ?? []).length > 0;

      public constructor(tableArn: string, tableName: string, tableId?: string, tableStreamArn?: string) {
        super(scope, id);

        const resourceRegion = stack.splitArn(tableArn, ArnFormat.SLASH_RESOURCE_NAME).region;
        if (!resourceRegion) {
          throw new Error('Table ARN must be of the form: arn:<partition>:dynamodb:<region>:<account>:table/<table-name>');
        }

        this.region = resourceRegion;
        this.tableArn = tableArn;
        this.tableName = tableName;
        this.tableId = tableId;
        this.tableStreamArn = tableStreamArn;
        this.encryptionKey = attrs.encryptionKey;
        this.tableStreamArn && this.streamArns.push(this.tableStreamArn);
      }
    }

    let tableName: string;
    let tableArn: string;
    const stack = Stack.of(scope);
    if (!attrs.tableArn) {
      if (!attrs.tableName) {
        throw new Error('At least one of `tableArn` or `tableName` must be provided');
      }

      tableName = attrs.tableName;
      tableArn = stack.formatArn({
        service: 'dynamodb',
        resource: 'table',
        resourceName: tableName,
      });
    } else {
      if (attrs.tableName) {
        throw new Error('Only one of `tableArn` or `tableName` can be provided, but not both');
      }

      tableArn = attrs.tableArn;
      const resourceName = stack.splitArn(tableArn, ArnFormat.SLASH_RESOURCE_NAME).resourceName;
      if (!resourceName) {
        throw new Error('Table ARN must be of the form: arn:<partition>:dynamodb:<region>:<account>:table/<table-name>');
      }
      tableName = resourceName;
    }

    return new Import(tableArn, tableName, attrs.tableId, attrs.tableStreamArn);
  }

  /**
   * @attribute
   */
  public readonly tableArn: string;

  /**
   * @attribute
   */
  public readonly tableName: string;

  /**
   * @attribute
   */
  public readonly tableStreamArn?: string;

  /**
   * @attribute
   */
  public readonly tableId?: string;

  public readonly encryptionKey?: IKey;

  protected readonly region: string;

  private readonly billingMode: string;
  private readonly partitionKey: Attribute;
  private readonly tableOptions: TableOptionsV2;
  private readonly encryption?: TableEncryptionV2;

  private readonly keySchema: CfnGlobalTable.KeySchemaProperty[] = [];
  private readonly attributeDefinitions: CfnGlobalTable.AttributeDefinitionProperty[] = [];
  private readonly nonKeyAttributes = new Set<string>();

  private readonly readProvisioning?: CfnGlobalTable.ReadProvisionedThroughputSettingsProperty;
  private readonly writeProvisioning?: CfnGlobalTable.WriteProvisionedThroughputSettingsProperty;

  private readonly replicaTables = new Map<string, ReplicaTableProps>();

  private readonly globalSecondaryIndexes = new Map<string, CfnGlobalTable.GlobalSecondaryIndexProperty>();
  private readonly localSecondaryIndexes = new Map<string, CfnGlobalTable.LocalSecondaryIndexProperty>();
  private readonly globalSecondaryIndexReadCapacitys = new Map<string, Capacity>();

  public constructor(scope: Construct, id: string, props: GlobalTableProps) {
    super(scope, id, { physicalName: props.tableName ?? PhysicalName.GENERATE_IF_NEEDED });

    this.tableOptions = props;
    this.partitionKey = props.partitionKey;
    this.region = this.stack.region;

    this.encryption = props.encryption;
    this.encryptionKey = this.encryption?.tableKey;
    this.configureReplicaKeys(this.encryption?.replicaKeyArns);

    this.addKey(props.partitionKey, HASH_KEY_TYPE);
    if (props.sortKey) {
      this.addKey(props.sortKey, RANGE_KEY_TYPE);
    }

    this.billingMode = props.billing?.mode ?? BillingMode.PAY_PER_REQUEST;
    this.readProvisioning = props.billing?._renderReadCapacity();
    this.writeProvisioning = props.billing?._renderWriteCapacity();

    props.globalSecondaryIndexes?.forEach(gsi => this.addGlobalSecondaryIndex(gsi));
    props.localSecondaryIndexes?.forEach(lsi => this.addLocalSecondaryIndex(lsi));

    const resource = new CfnGlobalTable(scope, 'Resource', {
      tableName: this.physicalName,
      keySchema: this.keySchema,
      attributeDefinitions: Lazy.any({ produce: () => this.attributeDefinitions }),
      replicas: Lazy.any({ produce: () => this.renderReplicaTables() }),
      globalSecondaryIndexes: Lazy.any({ produce: () => this.renderGlobalIndexes() }, { omitEmptyArray: true }),
      localSecondaryIndexes: Lazy.any({ produce: () => this.renderLocalIndexes() }, { omitEmptyArray: true }),
      billingMode: this.billingMode,
      writeProvisionedThroughputSettings: this.writeProvisioning,
      streamSpecification: Lazy.any({ produce: () => this.renderStreamSpecification() }),
      sseSpecification: this.encryption?._renderSseSpecification(),
      timeToLiveSpecification: props.timeToLiveAttribute
        ? { attributeName: props.timeToLiveAttribute, enabled: true }
        : undefined,
    });
    resource.applyRemovalPolicy(props.removalPolicy);

    this.tableArn = this.getResourceArnAttribute(resource.attrArn, {
      service: 'dynamodb',
      resource: 'table',
      resourceName: this.physicalName,
    });
    this.tableName = this.getResourceNameAttribute(resource.ref);
    this.tableId = resource.attrTableId;
    this.tableStreamArn = resource.attrStreamArn;

    this.streamArns.push(this.tableStreamArn);

    props.replicas?.forEach(replica => this.addReplica(replica));

    if (props.tableName) {
      this.node.addMetadata('aws:cdk:hasPhysicalName', this.tableName);
    }
  }

  /**
   * Add a Replica Table to the Global Table.
   *
   * @param props the properties of the Replica Table to add
   */
  public addReplica(props: ReplicaTableProps) {
    this.validateReplica(props);

    const replicaArn = this.stack.formatArn({
      region: props.region,
      resource: 'table',
      service: 'dynamodb',
      resourceName: this.tableName,
    });
    this.replicaArns.push(replicaArn);

    const replicaStreamArn = `${replicaArn}/stream/*`;
    this.streamArns.push(replicaStreamArn);

    this.replicaTables.set(props.region, props);
  }

  /**
   * Add a global secondary index to the Global Table.
   *
   * @param props the properties of the global secondary index
   */
  public addGlobalSecondaryIndex(props: GlobalSecondaryIndexPropsV2) {
    this.validateGlobalSecondaryIndex(props);
    const globalSecondaryIndex = this.configureGlobalSecondaryIndex(props);
    this.globalSecondaryIndexes.set(props.indexName, globalSecondaryIndex);
  }

  /**
   * Add a local secondary index to the Global Table.
   *
   * @param props the properties of the local secondary index
   */
  public addLocalSecondaryIndex(props: LocalSecondaryIndexProps) {
    this.validateLocalSecondaryIndex(props);
    const localSecondaryIndex = this.configureLocalSecondaryIndex(props);
    this.localSecondaryIndexes.set(props.indexName, localSecondaryIndex);
  }

  /**
   * Retrieve a Replica Table from the Global Table.
   *
   * Note: Replica Tables are not supported in a region agnostic stack. You can work with the
   * Replica Table in the Global Table deployment region via this Global Table.
   *
   * @param region the region of the Replica Table
   */
  public replica(region: string): IGlobalTable {
    if (Token.isUnresolved(this.stack.region)) {
      throw new Error('Replica Tables are not supported in a region agnostic stack');
    }

    if (Token.isUnresolved(region)) {
      throw new Error('Provided `region` cannot be a token');
    }

    if (region === this.stack.region) {
      return GlobalTable.fromTableAttributes(this, `ReplicaTable${region}`, {
        tableArn: this.tableArn,
        encryptionKey: this.encryptionKey,
        tableStreamArn: this.tableStreamArn,
        grantIndexPermissions: this.hasIndex,
      });
    }

    if (!this.replicaTables.has(region)) {
      throw new Error(`Global Table does not have a Replica Table in region ${region}`);
    }

    const tableArn = this.replicaArns.find(replicaArn => replicaArn.includes(region));
    const tableStreamArn = this.streamArns.find(streamArn => streamArn.includes(region));

    return GlobalTable.fromTableAttributes(this, `ReplicaTable${region}`, {
      tableArn,
      encryptionKey: this.replicaKeys[region],
      grantIndexPermissions: this.hasIndex,
      tableStreamArn,
    });
  }

  private configureReplicaTable(props: ReplicaTableProps): CfnGlobalTable.ReplicaSpecificationProperty {
    const pointInTimeRecovery = props.pointInTimeRecovery ?? this.tableOptions.pointInTimeRecovery;
    const contributorInsights = props.contributorInsights ?? this.tableOptions.contributorInsights;
    const kinesisStream = props.kinesisStream ?? this.tableOptions.kinesisStream;

    return {
      region: props.region,
      globalSecondaryIndexes: this.configureReplicaGlobalSecondaryIndexes(props.globalSecondaryIndexOptions),
      deletionProtectionEnabled: props.deletionProtection ?? this.tableOptions.deletionProtection,
      tableClass: props.tableClass ?? this.tableOptions.tableClass,
      sseSpecification: this.encryption?._renderReplicaSseSpecification(this, props.region),
      kinesisStreamSpecification: kinesisStream
        ? { streamArn: kinesisStream.streamArn }
        : undefined,
      contributorInsightsSpecification: contributorInsights !== undefined
        ? { enabled: contributorInsights }
        : undefined,
      pointInTimeRecoverySpecification: pointInTimeRecovery !== undefined
        ? { pointInTimeRecoveryEnabled: pointInTimeRecovery }
        : undefined,
      readProvisionedThroughputSettings: props.readCapacity
        ? props.readCapacity._renderReadCapacity()
        : this.readProvisioning,
    };
  }

  private configureGlobalSecondaryIndex(props: GlobalSecondaryIndexPropsV2): CfnGlobalTable.GlobalSecondaryIndexProperty {
    const keySchema = this.configureIndexKeySchema(props.partitionKey, props.sortKey);
    const projection = this.configureIndexProjection(props);

    props.readCapacity && this.globalSecondaryIndexReadCapacitys.set(props.indexName, props.readCapacity);
    const writeProvisionedThroughputSettings = props.writeCapacity ? props.writeCapacity._renderWriteCapacity() : this.writeProvisioning;

    return {
      indexName: props.indexName,
      keySchema,
      projection,
      writeProvisionedThroughputSettings,
    };
  }

  private configureLocalSecondaryIndex(props: LocalSecondaryIndexProps): CfnGlobalTable.LocalSecondaryIndexProperty {
    const keySchema = this.configureIndexKeySchema(this.partitionKey, props.sortKey);
    const projection = this.configureIndexProjection(props);

    return {
      indexName: props.indexName,
      keySchema,
      projection,
    };
  }

  private configureReplicaGlobalSecondaryIndexes(options: { [indexName: string]: ReplicaGlobalSecondaryIndexOptions } = {}) {
    this.validateReplicaIndexOptions(options);

    const replicaGlobalSecondaryIndexes: CfnGlobalTable.ReplicaGlobalSecondaryIndexSpecificationProperty[] = [];
    const indexNamesFromOptions = Object.keys(options);

    for (const gsi of this.globalSecondaryIndexes.values()) {
      const indexName = gsi.indexName;
      let contributorInsights = this.tableOptions.contributorInsights;
      let readCapacity = this.globalSecondaryIndexReadCapacitys.get(indexName);

      if (indexNamesFromOptions.includes(indexName)) {
        const indexOptions = options[indexName];
        contributorInsights = indexOptions.contributorInsights;
        readCapacity = indexOptions.readCapacity;
      }

      replicaGlobalSecondaryIndexes.push({
        indexName,
        readProvisionedThroughputSettings: readCapacity?._renderReadCapacity(),
        contributorInsightsSpecification: contributorInsights !== undefined
          ? { enabled: contributorInsights }
          : undefined,
      });
    }

    return replicaGlobalSecondaryIndexes.length > 0 ? replicaGlobalSecondaryIndexes : undefined;
  }

  private configureIndexKeySchema(partitionKey: Attribute, sortKey?: Attribute) {
    this.addAttributeDefinition(partitionKey);

    const indexKeySchema: CfnGlobalTable.KeySchemaProperty[] = [
      { attributeName: partitionKey.name, keyType: HASH_KEY_TYPE },
    ];

    if (sortKey) {
      this.addAttributeDefinition(sortKey);
      indexKeySchema.push({ attributeName: sortKey.name, keyType: RANGE_KEY_TYPE });
    }

    return indexKeySchema;
  }

  private configureIndexProjection(props: SecondaryIndexProps): CfnGlobalTable.ProjectionProperty {
    this.validateIndexProjection(props);

    props.nonKeyAttributes?.forEach(attr => this.nonKeyAttributes.add(attr));
    if (this.nonKeyAttributes.size > MAX_NON_KEY_ATTRIBUTES) {
      throw new Error(`The maximum number of 'nonKeyAttributes' across all secondary indexes is ${MAX_NON_KEY_ATTRIBUTES}`);
    }

    return {
      projectionType: props.projectionType ?? ProjectionType.ALL,
      nonKeyAttributes: props.nonKeyAttributes ?? undefined,
    };
  }

  private configureReplicaKeys(replicaKeyArns: { [region: string]: string } = {}) {
    for (const [region, keyArn] of Object.entries(replicaKeyArns)) {
      this.replicaKeys[region] = Key.fromKeyArn(this, `ReplicaKey${region}`, keyArn);
    }
  }

  private renderReplicaTables() {
    const replicaTables: CfnGlobalTable.ReplicaSpecificationProperty[] = [];

    for (const replicaTable of this.replicaTables.values()) {
      replicaTables.push(this.configureReplicaTable(replicaTable));
    }
    replicaTables.push(this.configureReplicaTable({ region: this.stack.region }));

    return replicaTables;
  }

  private renderGlobalIndexes() {
    const globalSecondaryIndexes: CfnGlobalTable.GlobalSecondaryIndexProperty[] = [];

    for (const globalSecondaryIndex of this.globalSecondaryIndexes.values()) {
      globalSecondaryIndexes.push(globalSecondaryIndex);
    }

    return globalSecondaryIndexes;
  }

  private renderLocalIndexes() {
    const localSecondaryIndexes: CfnGlobalTable.LocalSecondaryIndexProperty[] = [];

    for (const localSecondaryIndex of this.localSecondaryIndexes.values()) {
      localSecondaryIndexes.push(localSecondaryIndex);
    }

    return localSecondaryIndexes;
  }

  private renderStreamSpecification(): CfnGlobalTable.StreamSpecificationProperty | undefined {
    return this.replicaTables.size > 0 ? { streamViewType: NEW_AND_OLD_IMAGES } : undefined;
  }

  private addKey(key: Attribute, keyType: string) {
    this.addAttributeDefinition(key);
    this.keySchema.push({ attributeName: key.name, keyType });
  }

  private addAttributeDefinition(attribute: Attribute) {
    const { name, type } = attribute;

    const existingAttributeDef = this.attributeDefinitions.find(def => def.attributeName === name);
    if (existingAttributeDef && existingAttributeDef.attributeType !== type) {
      throw new Error(`Unable to specify ${name} as ${type} because it was already defined as ${existingAttributeDef.attributeType}`);
    }

    if (!existingAttributeDef) {
      this.attributeDefinitions.push({ attributeName: name, attributeType: type });
    }
  }

  protected get hasIndex() {
    return this.globalSecondaryIndexes.size + this.localSecondaryIndexes.size > 0;
  }

  private validateIndexName(indexName: string) {
    if (this.globalSecondaryIndexes.has(indexName) || this.localSecondaryIndexes.has(indexName)) {
      throw new Error(`Duplicate secondary index name, ${indexName}, is not allowed`);
    }
  }

  private validateIndexProjection(props: SecondaryIndexProps) {
    if (props.projectionType === ProjectionType.INCLUDE && !props.nonKeyAttributes) {
      throw new Error(`Non-key attributes should be specified when using ${ProjectionType.INCLUDE} projection type`);
    }

    if (props.projectionType !== ProjectionType.INCLUDE && props.nonKeyAttributes) {
      throw new Error(`Non-key attributes should not be specified when not using ${ProjectionType.INCLUDE} projection type`);
    }
  }

  private validateReplicaIndexOptions(options: { [indexName: string]: ReplicaGlobalSecondaryIndexOptions }) {
    for (const indexName of Object.keys(options)) {
      if (!this.globalSecondaryIndexes.has(indexName)) {
        throw new Error(`Cannot configure replica global secondary index, ${indexName}, because it is not defined on the global table`);
      }

      const replicaGsiOptions = options[indexName];
      if (this.billingMode === BillingMode.PAY_PER_REQUEST && replicaGsiOptions.readCapacity) {
        throw new Error(`Cannot configure 'readCapacity' for replica global secondary index, ${indexName}, because billing mode is ${BillingMode.PAY_PER_REQUEST}`);
      }
    }
  }

  private validateReplica(props: ReplicaTableProps) {
    const stackRegion = this.stack.region;
    if (Token.isUnresolved(stackRegion)) {
      throw new Error('Replica Tables are not supported in a region agnostic stack');
    }

    if (Token.isUnresolved(props.region)) {
      throw new Error('Replica Table region must not be a token');
    }

    if (props.region === this.stack.region) {
      throw new Error('A Replica Table in Global Table deployment region is configured by default and cannot be added explicitly');
    }

    if (this.replicaTables.has(props.region)) {
      throw new Error(`Duplicate Relica Table region, ${props.region}, is not allowed`);
    }

    if (this.billingMode === BillingMode.PAY_PER_REQUEST && props.readCapacity) {
      throw new Error(`You cannot provide 'readCapacity' on a Replica Table when the billing mode is ${BillingMode.PAY_PER_REQUEST}`);
    }
  }

  private validateGlobalSecondaryIndex(props: GlobalSecondaryIndexPropsV2) {
    this.validateIndexName(props.indexName);

    if (this.globalSecondaryIndexes.size === MAX_GSI_COUNT) {
      throw new Error(`You may not provide more than ${MAX_GSI_COUNT} global secondary indexes to a Global Table`);
    }

    if (this.billingMode === BillingMode.PAY_PER_REQUEST && (props.readCapacity || props.writeCapacity)) {
      throw new Error(`You cannot configure 'readCapacity' or 'writeCapacity' on a global secondary index when the billing mode is ${BillingMode.PAY_PER_REQUEST}`);
    }

    if (this.billingMode === BillingMode.PROVISIONED && !props.readCapacity) {
      throw new Error(`You must specify 'readCapacity' on a global secondary index when the billing mode is ${BillingMode.PROVISIONED}`);
    }
  }

  private validateLocalSecondaryIndex(props: LocalSecondaryIndexProps) {
    this.validateIndexName(props.indexName);

    if (this.localSecondaryIndexes.size === MAX_LSI_COUNT) {
      throw new Error(`You may not provide more than ${MAX_LSI_COUNT} local secondary indexes to a Global Table`);
    }
  }
}
